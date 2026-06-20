import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { log, logger } from './logger';
import { useConsoleStore } from '../store/consoleStore';
import type { ConsoleLogLevel } from '../types/console';

const entries = () => useConsoleStore.getState().entries;

describe('logger', () => {
  beforeEach(() => {
    useConsoleStore.getState().clear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('appends a console-pane entry at the requested level', () => {
    logger.info('hello');
    expect(entries()).toHaveLength(1);
    expect(entries()[0]).toMatchObject({ level: 'info', message: 'hello' });
  });

  it('records every level through its helper', () => {
    const levels: ConsoleLogLevel[] = ['debug', 'info', 'success', 'warn', 'error'];
    levels.forEach((level) => logger[level](`msg-${level}`));
    expect(entries().map((e) => e.level)).toEqual(levels);
    expect(entries().map((e) => e.message)).toEqual(levels.map((l) => `msg-${l}`));
  });

  it('mirrors errors and warnings to the matching browser console method', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    logger.error('boom');
    logger.warn('careful');

    expect(errorSpy).toHaveBeenCalledWith('boom');
    expect(warnSpy).toHaveBeenCalledWith('careful');
  });

  it('mirrors info and success to console.info', () => {
    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});

    logger.info('note');
    logger.success('done');

    expect(infoSpy).toHaveBeenCalledWith('note');
    expect(infoSpy).toHaveBeenCalledWith('done');
  });

  it('log() is the level-parameterized form of the helpers', () => {
    log('warn', 'low-level');
    expect(entries()[0]).toMatchObject({ level: 'warn', message: 'low-level' });
  });
});
