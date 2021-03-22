# Graphql KafkaJS Subscription

[![Code Style: Google](https://img.shields.io/badge/code%20style-google-blueviolet.svg)](https://github.com/google/gts)

An implementation for the Apollo PubSubEngine using the KafkaJS as backend.

This project was inspired on [graphql-kafka-subscriptions](https://github.com/ancashoria/graphql-kafka-subscriptions),
but forked to use the [KafkaJS](https://github.com/tulios/kafkajs) library instead of [node-rdkafka](https://github.com/Blizzard/node-rdkafka).

The main reason is because node-rdkafka uses librdkafka behind the scenes, needing to compile an external library that does not run as expected in all environments.
KafkaJS in other hand, is fully implemented in NodeJS and all features should work where they are supposed to.

## Installation

`npm install graphql-kafkajs-subscriptions`

## Usage

### Creating a PubSub

```js
const {KafkaPubSub} = require('graphql-kafkajs-subscriptions');

const pubSub = new KafkaPubSub({
  global: {
    brokers: ['localhost:9092'],
    clientId: 'my-client',
  },
  consumer: {
    groupId: 'meow-cat-1',
  }
});
```

### Publishing messages

```js
const message = {
  meow: 'cat',
};

pubSub.publish('topic', JSON.stringify(message));
```

### Using as a subscription async iterator

```js
const resolvers = {
  Subscription: {
    cats: pubSub.asyncIterator('cats-topic'),
  },
};
```


## Configuration

When creating the KafkaPubSub instance,
you may pass all configurations to KafkaJS using the configuration keys:

```js
const pubSub = new KafkaPubSub({
  global: {}, // This is the client configuration
  producer: {}, // This is the producer options
  consumer: {} // This is the consumer options
});
```

See KafkaJS reference for:
- [Client configuration](https://kafka.js.org/docs/configuration)
- [Producer options](https://kafka.js.org/docs/producing#options)
- [Consumer options](https://kafka.js.org/docs/consuming#options)
