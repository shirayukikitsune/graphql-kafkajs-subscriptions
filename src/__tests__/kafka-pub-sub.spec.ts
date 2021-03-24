import {KafkaPubSub} from '../kafka-pub-sub';

describe('KafkaPubSub', () => {
  test('Should be a class', () => {
    expect(typeof KafkaPubSub).toBe('function');
  });
});
