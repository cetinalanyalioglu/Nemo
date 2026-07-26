import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';
import { buildRuntimeModel, validateModelDefinition } from './model-builder';

/**
 * The shipped Nefes element library: it must clear the same validation the app runs at
 * start-up, and every glyph it names must exist as an asset (a missing one only warns in
 * the browser, so nothing else would catch it).
 */
const ROOT = resolve(__dirname, '../..');
const definition = yaml.load(readFileSync(resolve(ROOT, 'public/models/nefes.yaml'), 'utf8'));
const glyphKeys = new Set(
  readdirSync(resolve(ROOT, 'src/assets/glyphs'))
    .filter((f) => f.endsWith('.svg'))
    .map((f) => f.replace(/\.svg$/, ''))
);

describe('the shipped Nefes model', () => {
  const model = buildRuntimeModel(validateModelDefinition(definition));

  it('validates and builds', () => {
    expect(model.id).toBe('nefes');
    expect(Object.keys(model.nodeConfig).length).toBeGreaterThan(20);
  });

  it('names only glyphs that ship as assets', () => {
    for (const [type, config] of Object.entries(model.nodeConfig)) {
      if (config.glyph) expect(glyphKeys, `${type} glyph`).toContain(config.glyph);
    }
  });

  it('offers the junction and its two named settings as multi-port elements', () => {
    for (const type of ['Junction', 'LosslessSplitter', 'IdealMixer']) {
      const config = model.nodeConfig[type];
      expect(config, type).toBeDefined();
      expect(config.category).toBe('Multi port elements');
      expect(config.dynamicPorts).toBe(true);
    }
    // The two named settings carry no closure input: the name fixes it (solver side:
    // nefes.elements.catalog.lossless_splitter / ideal_mixer).
    for (const type of ['LosslessSplitter', 'IdealMixer']) {
      expect(Object.keys(model.nodeConfig[type].customParameters).sort()).toEqual([
        'label',
        'leftPorts',
        'rightPorts',
        'volume',
      ]);
      expect(model.nodeConfig[type].shape).toBe('rail');
    }
    const junction = Object.keys(model.nodeConfig.Junction.customParameters);
    expect(junction).toContain('K');
    expect(junction).toContain('recovery');
  });
});
