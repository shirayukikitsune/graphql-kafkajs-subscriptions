import {ConsumerConfig, KafkaConfig, ProducerConfig} from 'kafkajs';
import Logger = require('bunyan');

export interface KafkaPubSubConfig {
  global: KafkaConfig;
  producer?: ProducerConfig;
  consumer?: ConsumerConfig;
  log?: Logger;
}
