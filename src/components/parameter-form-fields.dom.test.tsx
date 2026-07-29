/**
 * A number being typed is not yet a number.
 *
 * Every field in this form stands between a person's keystrokes and a value the solver
 * will read, and the gap between the two is where the field earns its keep. "0." is not a
 * number and "-" is not a number, but both are what a number looks like halfway through
 * being typed, so the field has to hold them without either rejecting them or passing them
 * on. It keeps that half-finished text beside the committed value and shows the text while
 * an edit is open — which is why a native `type="number"` was abandoned here, and why
 * nothing is committed until the field is left.
 *
 * None of this is reachable by calling a function: the half-finished text lives in
 * component state and only exists between a keystroke and a blur. So this file renders the
 * form and types into it. It is the first here to do that, and the pattern it sets is the
 * one the panels should follow.
 */

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ParameterFormFields } from './parameter-form-fields';
import type { ParameterInfo, ParameterValues } from '../types/flow';

/** A number a model would declare, with a range and a step unless told otherwise. */
const numeric = (extra: Partial<ParameterInfo> = {}): ParameterInfo => ({
  label: 'Width',
  type: 'number',
  category: 'Geometry',
  ...extra,
});

type Rendered = {
  onUpdateParameter: ReturnType<typeof vi.fn>;
  onToggleGroup: ReturnType<typeof vi.fn>;
  container: HTMLElement;
  /** Re-renders the same form for a different element, as selecting another node does. */
  switchTo: (contextId: string, parameters: ParameterValues) => void;
};

/** Puts the form on screen with the parameters described and nothing else. */
const renderForm = (
  parametersInfo: Record<string, ParameterInfo>,
  parameters: ParameterValues = {},
  options: {
    collapsedGroups?: Record<string, boolean>;
    categoryPrecedence?: Record<string, number>;
    contextId?: string;
  } = {}
): Rendered => {
  const onUpdateParameter = vi.fn();
  const onToggleGroup = vi.fn();
  const form = (contextId: string, values: ParameterValues) => (
    <ParameterFormFields
      contextId={contextId}
      parameters={values}
      parametersInfo={parametersInfo}
      collapsedGroups={options.collapsedGroups ?? {}}
      onToggleGroup={onToggleGroup}
      onUpdateParameter={onUpdateParameter}
      categoryPrecedence={options.categoryPrecedence}
    />
  );
  const { container, rerender } = render(form(options.contextId ?? 'node-1', parameters));
  return {
    onUpdateParameter,
    onToggleGroup,
    container,
    switchTo: (contextId, values) => rerender(form(contextId, values)),
  };
};

/** The one text field on screen. */
const field = (): HTMLInputElement => screen.getByRole('textbox') as HTMLInputElement;

/**
 * The text field in the row labelled `label`.
 *
 * The label is a `<label>` with no `htmlFor` and the field is its sibling rather than its
 * child, so neither association a form query relies on holds; the row is walked instead.
 */
const fieldLabelled = (label: string): HTMLInputElement => {
  const row = screen.getByText(label).closest('.parameter-row');
  if (!row) throw new Error(`no parameter row labelled "${label}"`);
  return within(row as HTMLElement).getByRole('textbox') as HTMLInputElement;
};

/** The section headings, in the order they appear. */
const groupHeadings = (container: HTMLElement): string[] =>
  Array.from(container.querySelectorAll('.group-header-content span')).map((el) =>
    String(el.textContent)
  );

describe('a number part-way through being typed', () => {
  it('keeps a trailing decimal point on screen', () => {
    // The reason this form does not use `type="number"`: a native numeric input reports an
    // empty value for "0.", so the point is swallowed the moment it is typed and no
    // decimal can be entered left to right.
    renderForm({ width: numeric() }, { width: 5 });
    fireEvent.change(field(), { target: { value: '0.' } });
    expect(field().value).toBe('0.');
  });

  it('keeps a lone minus sign on screen', () => {
    // The first keystroke of every negative number, and not yet parseable as one.
    renderForm({ width: numeric() }, { width: 5 });
    fireEvent.change(field(), { target: { value: '-' } });
    expect(field().value).toBe('-');
  });

  it('is not committed until the field is left', () => {
    // Committing per keystroke would put 1, then 12, then 123 through the solver on the
    // way to typing 123 — and each of those is a value the model would act on.
    const { onUpdateParameter } = renderForm({ width: numeric() }, { width: 5 });
    fireEvent.change(field(), { target: { value: '1' } });
    fireEvent.change(field(), { target: { value: '12' } });
    fireEvent.change(field(), { target: { value: '123' } });
    expect(onUpdateParameter).not.toHaveBeenCalled();
  });

  it('is committed as a number, not as the text of one', () => {
    const { onUpdateParameter } = renderForm({ width: numeric() }, { width: 5 });
    fireEvent.change(field(), { target: { value: '12.5' } });
    fireEvent.blur(field(), { target: { value: '12.5' } });
    expect(onUpdateParameter).toHaveBeenCalledWith('width', 12.5);
  });

  it('refuses a keystroke that could not begin a number', () => {
    renderForm({ width: numeric() }, { width: 5 });
    fireEvent.change(field(), { target: { value: '1.5' } });
    fireEvent.change(field(), { target: { value: '1.5e' } });
    expect(field().value).toBe('1.5');
  });

  it('refuses a second decimal point', () => {
    renderForm({ width: numeric() }, { width: 5 });
    fireEvent.change(field(), { target: { value: '1.5' } });
    fireEvent.change(field(), { target: { value: '1.5.' } });
    expect(field().value).toBe('1.5');
  });

  it('lets text through untouched where the parameter is text', () => {
    // The digits-only guard is for numbers alone; a label may say anything.
    const { onUpdateParameter } = renderForm({ name: { label: 'Name', type: 'string' } });
    fireEvent.change(field(), { target: { value: 'Inlet 1.2.3' } });
    fireEvent.blur(field(), { target: { value: 'Inlet 1.2.3' } });
    expect(onUpdateParameter).toHaveBeenCalledWith('name', 'Inlet 1.2.3');
  });

  it('does not follow the user to another element', () => {
    // Half-finished text is held per element. Were it not, selecting a second node while
    // mid-edit would show it the first node's keystrokes over its own value — and commit
    // them there on the next blur.
    const { switchTo } = renderForm({ width: numeric() }, { width: 5 });
    fireEvent.change(field(), { target: { value: '999' } });
    switchTo('node-2', { width: 42 });
    expect(field().value).toBe('42');
  });
});

describe('a number outside what the model allows', () => {
  const bounded = { width: numeric({ min: 0, max: 10, unit: 'mm' }) };

  it('is not committed', () => {
    const { onUpdateParameter } = renderForm(bounded, { width: 5 });
    fireEvent.change(field(), { target: { value: '20' } });
    fireEvent.blur(field(), { target: { value: '20' } });
    expect(onUpdateParameter).not.toHaveBeenCalled();
  });

  it('stays on screen so it can be corrected rather than retyped', () => {
    const { onUpdateParameter } = renderForm(bounded, { width: 5 });
    fireEvent.change(field(), { target: { value: '20' } });
    fireEvent.blur(field(), { target: { value: '20' } });
    expect(field().value).toBe('20');
    expect(onUpdateParameter).not.toHaveBeenCalled();
  });

  it('says what the limit was, in the units the limit is in', () => {
    renderForm(bounded, { width: 5 });
    fireEvent.change(field(), { target: { value: '20' } });
    fireEvent.blur(field(), { target: { value: '20' } });
    expect(field().title).toBe('Value must not exceed 10 mm');
  });

  it('says so for a value below the floor as well', () => {
    renderForm(bounded, { width: 5 });
    fireEvent.change(field(), { target: { value: '-3' } });
    fireEvent.blur(field(), { target: { value: '-3' } });
    expect(field().title).toBe('Value must be at least 0 mm');
  });

  it('leaves the units off where the parameter has none', () => {
    renderForm({ width: numeric({ max: 10 }) }, { width: 5 });
    fireEvent.change(field(), { target: { value: '20' } });
    fireEvent.blur(field(), { target: { value: '20' } });
    expect(field().title).toBe('Value must not exceed 10');
  });

  it('is marked so the field reads as wrong at a glance', () => {
    renderForm(bounded, { width: 5 });
    fireEvent.change(field(), { target: { value: '20' } });
    fireEvent.blur(field(), { target: { value: '20' } });
    expect(field().className).toContain('invalid');
  });

  it('stops being marked once a value inside the range is entered', () => {
    const { onUpdateParameter } = renderForm(bounded, { width: 5 });
    fireEvent.change(field(), { target: { value: '20' } });
    fireEvent.blur(field(), { target: { value: '20' } });
    fireEvent.change(field(), { target: { value: '7' } });
    fireEvent.blur(field(), { target: { value: '7' } });
    expect(field().className).not.toContain('invalid');
    expect(onUpdateParameter).toHaveBeenCalledWith('width', 7);
  });

  it('is told plainly when it is not a number at all', () => {
    const { onUpdateParameter } = renderForm(bounded, { width: 5 });
    fireEvent.change(field(), { target: { value: '.' } });
    fireEvent.blur(field(), { target: { value: '.' } });
    expect(field().title).toBe('Please enter a valid number');
    expect(onUpdateParameter).not.toHaveBeenCalled();
  });

  it('is told the same when the field is emptied', () => {
    // An empty field parses as NaN, which is neither above the ceiling nor below the
    // floor; without its own case it would commit as NaN.
    const { onUpdateParameter } = renderForm(bounded, { width: 5 });
    fireEvent.change(field(), { target: { value: '' } });
    fireEvent.blur(field(), { target: { value: '' } });
    expect(field().title).toBe('Please enter a valid number');
    expect(onUpdateParameter).not.toHaveBeenCalled();
  });
});

describe('the buttons beside a stepped number', () => {
  const stepped = { width: numeric({ min: 0, max: 10, step: 2 }) };
  const nudge = (direction: 'Increase' | 'Decrease') =>
    fireEvent.click(screen.getByRole('button', { name: direction }));

  it('are offered only where the model gave a step', () => {
    renderForm({ width: numeric() }, { width: 5 });
    expect(screen.queryByRole('button', { name: 'Increase' })).toBeNull();
  });

  it('move the value by that step', () => {
    const { onUpdateParameter } = renderForm(stepped, { width: 4 });
    nudge('Increase');
    expect(onUpdateParameter).toHaveBeenCalledWith('width', 6);
  });

  it('move it back down by the same step', () => {
    const { onUpdateParameter } = renderForm(stepped, { width: 4 });
    nudge('Decrease');
    expect(onUpdateParameter).toHaveBeenCalledWith('width', 2);
  });

  it('stop at the ceiling rather than stepping past it', () => {
    // Held down at the top of the range, the button must not walk the value out of the
    // range the typed field would have refused.
    const { onUpdateParameter } = renderForm(stepped, { width: 10 });
    nudge('Increase');
    expect(onUpdateParameter).toHaveBeenCalledWith('width', 10);
  });

  it('stop at the floor rather than stepping past it', () => {
    const { onUpdateParameter } = renderForm(stepped, { width: 0 });
    nudge('Decrease');
    expect(onUpdateParameter).toHaveBeenCalledWith('width', 0);
  });

  it('step from what is on screen, not from what was last committed', () => {
    // A step taken mid-edit has to start from the text in the field; starting from the
    // committed value would silently discard whatever had been typed.
    const { onUpdateParameter } = renderForm(stepped, { width: 0 });
    fireEvent.change(field(), { target: { value: '4' } });
    nudge('Increase');
    expect(onUpdateParameter).toHaveBeenCalledWith('width', 6);
  });

  it('step down from what is on screen too', () => {
    // The two buttons read the half-finished text separately, so either could come to
    // start from the committed value while the other still reads the field.
    const { onUpdateParameter } = renderForm(stepped, { width: 10 });
    fireEvent.change(field(), { target: { value: '4' } });
    nudge('Decrease');
    expect(onUpdateParameter).toHaveBeenCalledWith('width', 2);
  });

  it('put the stepped value in the field', () => {
    const { onUpdateParameter } = renderForm(stepped, { width: 4 });
    nudge('Increase');
    expect(field().value).toBe('6');
    expect(onUpdateParameter).toHaveBeenCalledWith('width', 6);
  });

  it('put the value stepped down in the field as well', () => {
    const { onUpdateParameter } = renderForm(stepped, { width: 4 });
    nudge('Decrease');
    expect(field().value).toBe('2');
    expect(onUpdateParameter).toHaveBeenCalledWith('width', 2);
  });
});

describe('a parameter the model will not let anyone change', () => {
  const readOnly = { width: numeric({ editable: false, step: 1 }) };

  it('cannot be typed into', () => {
    renderForm(readOnly, { width: 5 });
    expect(field().disabled).toBe(true);
  });

  it('is marked as read-only rather than merely inert', () => {
    renderForm(readOnly, { width: 5 });
    expect(field().className).toContain('readonly');
  });

  it('commits nothing even if a change reaches it', () => {
    const { onUpdateParameter } = renderForm(readOnly, { width: 5 });
    fireEvent.change(field(), { target: { value: '9' } });
    fireEvent.blur(field(), { target: { value: '9' } });
    expect(onUpdateParameter).not.toHaveBeenCalled();
  });

  it('is offered no buttons to step it with', () => {
    renderForm(readOnly, { width: 5 });
    expect(screen.queryByRole('button', { name: 'Increase' })).toBeNull();
  });
});

describe('a parameter that only applies sometimes', () => {
  const conditional = {
    mode: { label: 'Mode', type: 'string', category: 'Geometry' },
    slope: {
      label: 'Slope',
      type: 'number',
      category: 'Geometry',
      visibleIf: { parameter: 'mode', equals: 'ramp' },
    },
  } as Record<string, ParameterInfo>;

  it('is absent while its condition does not hold', () => {
    renderForm(conditional, { mode: 'flat' });
    expect(screen.queryByText('Slope')).toBeNull();
  });

  it('appears once it does', () => {
    renderForm(conditional, { mode: 'ramp' });
    expect(screen.getByText('Slope')).toBeTruthy();
  });

  it('is absent while the model says it is hidden outright', () => {
    renderForm({ width: numeric({ visible: false }) }, { width: 5 });
    expect(screen.queryByText('Width')).toBeNull();
  });
});

describe('a parameter that is on or off', () => {
  const flag = { sealed: { label: 'Sealed', type: 'boolean', category: 'Geometry' } };

  /** The tick box. It is a `div` with a click handler, so it carries no role to ask for. */
  const box = (container: HTMLElement): HTMLElement => {
    const el = container.querySelector('.checkbox-wrapper');
    if (!el) throw new Error('no checkbox on screen');
    return el as HTMLElement;
  };

  it('turns on when it was off', () => {
    const { container, onUpdateParameter } = renderForm(flag, { sealed: false });
    fireEvent.click(box(container));
    expect(onUpdateParameter).toHaveBeenCalledWith('sealed', true);
  });

  it('turns off when it was on', () => {
    const { container, onUpdateParameter } = renderForm(flag, { sealed: true });
    fireEvent.click(box(container));
    expect(onUpdateParameter).toHaveBeenCalledWith('sealed', false);
  });

  it('shows which way it is set', () => {
    const { container } = renderForm(flag, { sealed: true });
    expect(box(container).className).toContain('checked');
  });

  it('does not toggle where the model will not allow it', () => {
    const { container, onUpdateParameter } = renderForm(
      { sealed: { label: 'Sealed', type: 'boolean', editable: false } },
      { sealed: false }
    );
    fireEvent.click(box(container));
    expect(onUpdateParameter).not.toHaveBeenCalled();
  });
});

describe('a parameter chosen from a list', () => {
  const choice = {
    shape: {
      label: 'Shape',
      type: 'select',
      category: 'Geometry',
      options: [{ value: 'round' }, { value: 'square', label: 'Square' }],
    },
  } as Record<string, ParameterInfo>;

  it('shows what is currently chosen', () => {
    renderForm(choice, { shape: 'square' });
    expect(screen.getByRole('button', { name: 'Square' })).toBeTruthy();
  });

  it('commits the choice that was picked', () => {
    const { onUpdateParameter } = renderForm(choice, { shape: 'round' });
    fireEvent.click(screen.getByRole('button', { name: 'round' }));
    fireEvent.click(screen.getByRole('option', { name: 'Square' }));
    expect(onUpdateParameter).toHaveBeenCalledWith('shape', 'square');
  });

  it('cannot be opened where the model will not allow it', () => {
    renderForm(
      { shape: { ...choice.shape, editable: false } as ParameterInfo },
      { shape: 'round' }
    );
    expect((screen.getByRole('button', { name: 'round' }) as HTMLButtonElement).disabled).toBe(
      true
    );
  });
});

describe('what the form shows before anything is typed', () => {
  it('shows the value recorded against the element', () => {
    renderForm({ width: numeric({ defaultValue: 1 }) }, { width: 5 });
    expect(field().value).toBe('5');
  });

  it('falls back to the model default where the element has no value', () => {
    renderForm({ width: numeric({ defaultValue: 1 }) }, {});
    expect(field().value).toBe('1');
  });

  it('shows an empty field where there is neither', () => {
    renderForm({ width: numeric() }, {});
    expect(field().value).toBe('');
  });

  it('shows the units the value is in', () => {
    renderForm({ width: numeric({ unit: 'mm' }) }, { width: 5 });
    expect(screen.getByText('mm')).toBeTruthy();
  });

  it('says so plainly when the model declares no parameters at all', () => {
    renderForm({});
    expect(screen.getByText('No model parameters defined for this model.')).toBeTruthy();
  });
});

describe('how the sections are arranged', () => {
  const twoSections = {
    width: numeric({ label: 'Width', category: 'Zulu' }),
    depth: numeric({ label: 'Depth', category: 'Alpha' }),
  };

  it('are in alphabetical order where the model asks for nothing else', () => {
    const { container } = renderForm(twoSections);
    expect(groupHeadings(container)).toEqual(['ALPHA', 'ZULU']);
  });

  it('follow the order the model asked for', () => {
    // A model orders its sections by what a user reads first, which is rarely the
    // alphabet.
    const { container } = renderForm(twoSections, {}, { categoryPrecedence: { Zulu: 1 } });
    expect(groupHeadings(container)).toEqual(['ZULU', 'ALPHA']);
  });

  it('gather a parameter with no section of its own under one', () => {
    const { container } = renderForm({ width: numeric({ category: undefined }) });
    expect(groupHeadings(container)).toEqual(['OTHER']);
  });

  it('keep each parameter under the section it was declared in', () => {
    renderForm(twoSections, { width: 5, depth: 9 });
    expect(fieldLabelled('Width').value).toBe('5');
    expect(fieldLabelled('Depth').value).toBe('9');
  });

  it('report which section was clicked so it can be folded away', () => {
    const { container, onToggleGroup } = renderForm(twoSections);
    fireEvent.click(container.querySelectorAll('.group-header')[0]);
    expect(onToggleGroup).toHaveBeenCalledWith('__model_param_Alpha__');
  });

  it('show as folded the ones already folded away', () => {
    const { container } = renderForm(
      twoSections,
      {},
      {
        collapsedGroups: { __model_param_Alpha__: true },
      }
    );
    const groups = container.querySelectorAll('.parameter-group');
    expect(groups[0].className).toContain('collapsed');
    expect(groups[1].className).not.toContain('collapsed');
  });
});
