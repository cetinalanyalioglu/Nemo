# Parameter Configuration Guide

This guide explains the available options for configuring node parameters in the flow editor.
By default, all parameters are included in the JSON output and restored on load.

## Basic Parameter Structure

Each parameter is defined as an object with various configuration options:

```javascript
{
    label: 'Parameter Name',
    type: 'float',
    defaultValue: 0,
    category: 'Parameters',
    // ... other options
}
```

## Available Options

### Basic Properties

| Property       | Type   | Description                          | Example                                        |
| -------------- | ------ | ------------------------------------ | ---------------------------------------------- |
| `label`        | string | Display name in the properties panel | `"Mass Flow Rate"`                             |
| `type`         | string | Parameter data type                  | `"float"`, `"number"`, `"string"`, `"boolean"` |
| `defaultValue` | any    | Initial value                        | `1.0`, `"text"`, `false`                       |
| `category`     | string | Group in properties panel            | `"Parameters"`, `"Appearance"`                 |
| `unit`         | string | Physical unit (for numeric types)    | `"kg/s"`, `"Pa"`, `"K"`                        |

### Visibility Control

Control parameter visibility in the properties panel:

```javascript
{
    // Never show in properties panel
    visible: false,

    // Show based on conditions
    visibleIf: {
        // Simple condition
        parameter: 'otherParam',
        equals: true,

        // Complex AND condition
        and: [
            { parameter: 'mode', equals: 'advanced' },
            { parameter: 'pressure', greaterThan: 100 }
        ],

        // Complex OR condition
        or: [
            { parameter: 'mode', oneOf: ['advanced', 'expert'] },
            { parameter: 'enabled', equals: true }
        ]
    }
}
```

#### Available Conditions

- `equals`: Exact value match
- `greaterThan`: Numeric comparison (>)
- `lessThan`: Numeric comparison (<)
- `oneOf`: Value in array
- Combine with `and`/`or` for complex logic

### Numeric Constraints

For `number` and `float` types:

```javascript
{
    type: 'float',
    min: 0,           // Minimum allowed value
    max: 100,         // Maximum allowed value
    step: 0.1,        // Increment/decrement step (shows +/- buttons)
}
```

### Editability Control

Control whether a parameter can be modified:

```javascript
{
    // Disable editing
    editable: false,

    // Could be extended to support conditional editing
    editableIf: {
        parameter: 'mode',
        equals: 'expert'
    }
}
```

## Complete Example

```javascript
{
    massFlowRate: {
        label: 'Mass Flow Rate',
        type: 'float',
        defaultValue: 1.0,
        category: 'Parameters',
        unit: 'kg/s',
        min: 0,
        max: 1000,
        step: 0.1,
        editable: true,
        visibleIf: {
            and: [
                { parameter: 'mode', equals: 'advanced' },
                { parameter: 'enabled', equals: true }
            ]
        }
    },
    internalState: {
        type: 'string',
        defaultValue: '',
        visible: false  // Hidden internal parameter
    }
}
```

## Best Practices

1. **Categorization**

   - Group related parameters in the same category
   - Use consistent category names across nodes

2. **Visibility**

   - Hide internal parameters with `visible: false`
   - Use `visibleIf` for contextual parameters

3. **Numeric Parameters**

   - Always specify `min`/`max` for bounded values
   - Include `unit` for physical quantities
   - Use `step` for parameters that should increment/decrement

4. **Labels**

   - Use clear, descriptive labels
   - Include units in label if not using `unit` property

5. **Default Values**
   - Always provide sensible `defaultValue`
   - Ensure default values meet constraints
