import {PubSubEngine} from 'graphql-subscriptions';
import {Consumer, Kafka, Message, Producer} from 'kafkajs';
import {KafkaPubSubConfig} from './kafka-pub-sub-config';
import {PubSubAsyncIterator} from './pubsub-async-iterator';
import {Subject, Subscription} from 'rxjs';
import Logger from 'bunyan';

interface SubscriptionMap<T> {
  [topic: string]: Subject<T>;
}

export class KafkaPubSub extends PubSubEngine {
  private kafka: Kafka;
  private producer?: Producer;
  private consumer?: Consumer;
  private subscriptionMap: SubscriptionMap<unknown> = {};
  private subscriptionRefCount: {[id: string]: number} = {};
  private subscriptions: {[id: number]: [Subscription, string]} = {};
  private idGenerator = KafkaPubSub.subscriptionIdGenerator();
  private log?: Logger;

  constructor(private config: KafkaPubSubConfig) {
    super();
    this.kafka = new Kafka(config.global);
    this.log = this.config.log;
  }

  async publish(triggerName: string, payload: Message | Buffer | string): Promise<void> {
    if (!this.producer) {
      this.log?.debug({topic: triggerName}, 'Creating producer instance');
      await this.createProducer();
      this.log?.debug({topic: triggerName}, 'Producer instance created');
    }

    const message: Message =
      typeof payload === 'string' || 'buffer' in payload ? {value: payload} : payload;

    this.log?.debug({topic: triggerName}, 'Sending message');
    const metadata = await this.producer?.send({
      topic: triggerName,
      messages: [message],
    });
    this.log?.debug({metadata, topic: triggerName}, 'Message sent');
  }

  async subscribe(
    triggerName: string,
    onMessage: Function,
    options?: {fromBeginning?: boolean}
  ): Promise<number> {
    await this.createConsumer();

    const subscriptionId = <number>this.idGenerator.next().value;
    let subject: Subject<unknown>;
    if (!this.subscriptionMap[triggerName] || this.subscriptionMap[triggerName].closed) {
      this.log?.debug(
        {topic: triggerName, subscriptionId},
        'No consumers for topic. Creating new subject.'
      );
      subject = new Subject<unknown>();
      this.subscriptionMap[triggerName] = subject;
      this.subscriptionRefCount[triggerName] = 1;
      this.log?.info({topic: triggerName, subscriptionId}, 'Subject created');
      await this.connectConsumer({topic: triggerName, fromBeginning: options?.fromBeginning});
    } else {
      this.log?.debug({topic: triggerName, subscriptionId}, 'Subject found, reusing');
      subject = this.subscriptionMap[triggerName];
      this.subscriptionRefCount[triggerName]++;
    }

    this.subscriptions[subscriptionId] = [
      subject.subscribe({
        next: value => onMessage(value),
      }),
      triggerName,
    ];

    return Promise.resolve(subscriptionId);
  }

  public asyncIterator<T>(triggers: string | string[], options: Object = {}): AsyncIterator<T> {
    return new PubSubAsyncIterator<T>(this, triggers, options);
  }

  public unsubscribe(subscriptionId: number) {
    this.log?.info({subscriptionId}, 'Closing subscription');
    const [subscription, topic] = this.subscriptions[subscriptionId];
    subscription.unsubscribe();
    const log = this.log?.child({subscriptionId, topic}, true);
    log?.info('Decreasing topic RefCount');
    if (--this.subscriptionRefCount[topic] === 0) {
      log?.debug('Deleting subscription RefCount');
      delete this.subscriptionRefCount[topic];
      log?.debug('Finding topic for subscription');
      const ref = Object.entries(this.subscriptionMap).find(e => e[0] === topic);
      if (ref) {
        log?.debug('Closing subject');
        ref[1].complete();
        ref[1].unsubscribe();
        log?.debug('Deleting subscription map entry');
        delete this.subscriptionMap[ref[0]];
      }

      if (Object.keys(this.subscriptionRefCount).length === 0) {
        log?.info('No subscribers left, pausing consumer');
        this.consumer?.stop();
      }
    }
  }

  private async createProducer() {
    this.producer = this.kafka.producer(this.config.producer);

    await this.producer.connect();
  }

  private async createConsumer() {
    if (this.consumer) {
      return;
    }

    this.log?.debug('Creating consumer instance');
    this.consumer = this.kafka.consumer(this.config.consumer);
    this.log?.debug('Connecting consumer');
    await this.consumer.connect();
    this.log?.debug('Consumer instance created');
  }

  private async connectConsumer(options: {topic: string; fromBeginning?: boolean}) {
    this.log?.info('Connecting consumer');
    await this.consumer?.subscribe(options);
    this.consumer?.run({
      eachMessage: async payload => {
        this.log?.debug(payload, 'Incoming message');
        const subject = this.subscriptionMap[payload.topic];
        if (subject && !subject.closed) {
          if (payload.message.value) {
            const data = JSON.parse(payload.message.value.toString());
            subject.next(data);
          }
        }
      },
    });
  }

  private static *subscriptionIdGenerator() {
    let index = 0;
    while (true) {
      yield ++index;
    }
  }
}
