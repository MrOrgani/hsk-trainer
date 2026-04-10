# Hanzi Writer Documentation

## Installation

### Via Script Tag

```html
<script src="https://cdn.jsdelivr.net/npm/hanzi-writer@3.5/dist/hanzi-writer.min.js"></script>
```

**Available files:**
- `hanzi-writer.min.js` - minified for production (30 KB, 9 KB gzipped)
- `hanzi-writer.js` - unminified for development (70 KB)

This creates a global `HanziWriter` variable.

### Via NPM

```bash
npm install hanzi-writer
```

```javascript
const HanziWriter = require('hanzi-writer');
```

### Browser Compatibility

For Internet Explorer 10 and 11, add a Promise polyfill before loading HanziWriter:

```html
<script src="https://cdn.polyfill.io/v2/polyfill.min.js"></script>
```

---

## Basic Usage

### Rendering Characters

```javascript
var writer = HanziWriter.create('character-target-div', '我', {
  width: 100,
  height: 100,
  padding: 5
});
```

**Color customization:**

```javascript
var writer = HanziWriter.create('character-target-div', '爽', {
  width: 150,
  height: 150,
  padding: 20,
  strokeColor: '#EE00FF'
});
```

**Radical coloring:**

```javascript
var writer = HanziWriter.create('character-target-div', '草', {
  width: 150,
  height: 150,
  padding: 5,
  radicalColor: '#168F16'
});
```

### Animation

```javascript
var writer = HanziWriter.create('character-target-div', '国', {
  width: 100,
  height: 100,
  padding: 5,
  showOutline: true
});

document.getElementById('animate-button').addEventListener('click', function() {
  writer.animateCharacter();
});
```

**Animation options:**

```javascript
var writer = HanziWriter.create('character-target-div', '激', {
  width: 100,
  height: 100,
  padding: 5,
  showOutline: false,
  strokeAnimationSpeed: 5,
  delayBetweenStrokes: 10,
  radicalColor: '#337ab7'
});
```

### Looping Animations

```javascript
var writer = HanziWriter.create('character-target-div', '轮', {
  width: 100,
  height: 100,
  padding: 5,
  delayBetweenLoops: 3000
});

writer.loopCharacterAnimation();
```

### Chaining Animations

Using callbacks:

```javascript
char1.animateCharacter({
  onComplete: function() {
    setTimeout(function() {
      char2.animateCharacter();
    }, delayBetweenAnimations);
  }
});
```

Using promises:

```javascript
char1.animateCharacter().then(function() {
  return char2.animateCharacter();
});
```

### Quizzing

```javascript
var writer = HanziWriter.create('character-target-div', '测', {
  width: 150,
  height: 150,
  showCharacter: false,
  padding: 5
});

writer.quiz();
```

**Quiz customization:**

```javascript
var writer = HanziWriter.create('character-target-div', '鬼', {
  width: 150,
  height: 150,
  showCharacter: false,
  showOutline: false,
  showHintAfterMisses: 1,
  highlightOnComplete: false,
  padding: 5
});

writer.quiz();
```

### Integrating Quizzes with Callbacks

```javascript
writer.quiz({
  onMistake: function(strokeData) {
    console.log('Mistake on stroke ' + strokeData.strokeNum);
    console.log('Mistakes on this stroke: ' + strokeData.mistakesOnStroke);
    console.log('Total mistakes: ' + strokeData.totalMistakes);
    console.log('Strokes remaining: ' + strokeData.strokesRemaining);
  },
  onCorrectStroke: function(strokeData) {
    console.log('Correct! Stroke ' + strokeData.strokeNum);
    console.log('Mistakes on this stroke: ' + strokeData.mistakesOnStroke);
    console.log('Total mistakes: ' + strokeData.totalMistakes);
    console.log('Strokes remaining: ' + strokeData.strokesRemaining);
  },
  onComplete: function(summaryData) {
    console.log('Finished character: ' + summaryData.character);
    console.log('Total mistakes: ' + summaryData.totalMistakes);
  }
});
```

**Callback data — onMistake / onCorrectStroke:**
- `totalMistakes` - Total quiz mistakes so far
- `strokeNum` - Current stroke number
- `mistakesOnStroke` - Mistakes on this specific stroke
- `strokesRemaining` - Strokes left to complete
- `drawnPath` - Object with `pathString` and `points` used for grading

**Callback data — onComplete:**
- `character` - The character being quizzed
- `totalMistakes` - Total mistakes in quiz

### Other Methods

```javascript
writer.setCharacter('新');       // Load new character
writer.showCharacter();          // Show character
writer.hideCharacter();          // Hide character
writer.showOutline();            // Show outline
writer.hideOutline();            // Hide outline
writer.updateColor('strokeColor', '#AA12CD');  // Update color
writer.cancelQuiz();             // Cancel active quiz
writer.pauseAnimation();         // Pause animations
writer.resumeAnimation();        // Resume animations
writer.updateDimensions({ width: 150, height: 150, padding: 10 });
```

---

## Advanced Usage

### Loading Character Data

By default, HanziWriter loads stroke data from the jsdelivr CDN via AJAX.

**Custom AJAX loader:**

```javascript
var writer = HanziWriter.create('target', '我', {
  charDataLoader: function(char, onComplete) {
    $.getJSON("/my/server/" + char + ".json", function(charData) {
      onComplete(charData);
    });
  }
});
```

**Embedding character data directly:**

```bash
npm install hanzi-writer-data
```

```javascript
var ren = require('hanzi-writer-data/人');

var writer = HanziWriter.create('target', '人', {
  charDataLoader: function() {
    return ren;
  }
});
```

**Loading callbacks:**

```javascript
var writer = HanziWriter.create('target', '人', {
  onLoadCharDataSuccess: function(data) {
    console.log('Character data loaded successfully');
  },
  onLoadCharDataError: function(reason) {
    console.log('Failed to load character data');
  }
});
```

### Raw Character SVG

**Loading character data:**

```javascript
HanziWriter.loadCharacterData('六').then(function(charData) {
  // Use charData.strokes for rendering
});
```

**Rendering SVG with scaling:**

```javascript
HanziWriter.loadCharacterData('六').then(function(charData) {
  var target = document.getElementById('target');
  var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.style.width = '150px';
  svg.style.height = '150px';
  target.appendChild(svg);

  var group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  var transformData = HanziWriter.getScalingTransform(150, 150);
  group.setAttributeNS(null, 'transform', transformData.transform);
  svg.appendChild(group);

  charData.strokes.forEach(function(strokePath) {
    var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttributeNS(null, 'd', strokePath);
    path.style.fill = '#555';
    group.appendChild(path);
  });
});
```

**Stroke fanning example:**

```javascript
function renderFanningStrokes(target, strokes) {
  var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.style.width = '75px';
  svg.style.height = '75px';
  svg.style.border = '1px solid #EEE';
  svg.style.marginRight = '3px';
  target.appendChild(svg);

  var group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  var transformData = HanziWriter.getScalingTransform(75, 75);
  group.setAttributeNS(null, 'transform', transformData.transform);
  svg.appendChild(group);

  strokes.forEach(function(strokePath) {
    var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttributeNS(null, 'd', strokePath);
    path.style.fill = '#555';
    group.appendChild(path);
  });
}

HanziWriter.loadCharacterData('是').then(function(charData) {
  var target = document.getElementById('target');
  for (var i = 0; i < charData.strokes.length; i++) {
    var strokesPortion = charData.strokes.slice(0, i + 1);
    renderFanningStrokes(target, strokesPortion);
  }
});
```

### Custom SVG Backgrounds

```html
<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" id="grid-background-target">
  <line x1="0" y1="0" x2="100" y2="100" stroke="#DDD" />
  <line x1="100" y1="0" x2="0" y2="100" stroke="#DDD" />
  <line x1="50" y1="0" x2="50" y2="100" stroke="#DDD" />
  <line x1="0" y1="50" x2="100" y2="50" stroke="#DDD" />
</svg>
```

```javascript
var writer = HanziWriter.create('grid-background-target', '酷', {
  width: 100,
  height: 100,
  padding: 5
});
```

---

## Complete API Reference

### HanziWriter Constructor

```javascript
new HanziWriter(element, options)
```

Factory method:

```javascript
HanziWriter.create(element, character, options)
```

**Parameters:**
- `element` - DOM node or element ID string
- `character` - Character to render (e.g., '你')
- `options` - Configuration object

### Constructor Options

**Display Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `showOutline` | boolean | `true` | Show outline on first render |
| `showCharacter` | boolean | `true` | Show character on first render |
| `width` | number | - | Canvas width in pixels |
| `height` | number | - | Canvas height in pixels |
| `padding` | number | `20` | Padding in pixels |
| `renderer` | string | `'svg'` | `'svg'` or `'canvas'` for 2D canvas rendering |

**Animation Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `strokeAnimationSpeed` | number | `1` | Stroke drawing speed multiplier |
| `strokeHighlightSpeed` | number | `2` | Highlight speed multiplier |
| `strokeFadeDuration` | number | `400` | Fade duration in ms |
| `delayBetweenStrokes` | number | `1000` | Delay between strokes in ms |
| `delayBetweenLoops` | number | `2000` | Loop delay in ms |

**Color Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `strokeColor` | hex string | `'#555'` | Rendered stroke color |
| `radicalColor` | hex string | `null` | Radical highlight color |
| `highlightColor` | hex string | `'#AAF'` | Quiz hint highlight color |
| `outlineColor` | hex string | `'#DDD'` | Outline color |
| `drawingColor` | hex string | `'#333'` | User drawing color |
| `drawingWidth` | number | `4` | User drawing width in px |
| `highlightCompleteColor` | hex string | `null` | Completion highlight color |

**Quiz Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `showHintAfterMisses` | integer | `3` | Misses before showing hint |
| `markStrokeCorrectAfterMisses` | integer | disabled | Force correct after N misses |
| `quizStartStrokeNum` | integer | `0` | Starting stroke number |
| `acceptBackwardsStrokes` | boolean | `false` | Allow reverse direction strokes |
| `highlightOnComplete` | boolean | `true` | Flash on quiz completion |
| `leniency` | float | `1.0` | Grading strictness (0 = strictest) |

**Data Loading Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `charDataLoader` | function | CDN loader | Custom character data loader |
| `onLoadCharDataSuccess` | function | - | Success callback |
| `onLoadCharDataError` | function | - | Error callback |

### Instance Methods

#### writer.showCharacter(options?)
Display the character. Options: `onComplete` (function), `duration` (number, ms; 0 = instant).

#### writer.hideCharacter(options?)
Hide the character. Options: `onComplete`, `duration`.

#### writer.showOutline(options?)
Display the character outline. Options: `onComplete`, `duration`.

#### writer.hideOutline(options?)
Hide the character outline. Options: `onComplete`, `duration`.

#### writer.updateDimensions(options?)
Resize the canvas. Options: `width`, `height`, `padding` (all optional numbers).

#### writer.updateColor(colorName, colorVal, options?)
Change a color setting.
- `colorName` — one of: `'strokeColor'`, `'radicalColor'`, `'outlineColor'`, `'highlightColor'`, `'drawingColor'`
- `colorVal` — CSS color string (e.g., `'#AA9913'` or `'rgba(255, 255, 10, 0.7)'`)
- Options: `onComplete`, `duration`.

#### writer.animateCharacter(options?)
Animate all strokes in sequence. Options: `onComplete`. Returns a Promise.

#### writer.animateStroke(strokeNum, options?)
Animate a single stroke. `strokeNum` is 0-indexed. Options: `onComplete`.

#### writer.highlightStroke(strokeNum, options?)
Highlight a single stroke. `strokeNum` is 0-indexed. Options: `onComplete`.

#### writer.loopCharacterAnimation()
Continuously animate the character in cycles.

#### writer.pauseAnimation()
Pause any active animations.

#### writer.resumeAnimation()
Resume paused animations.

#### writer.setCharacter(character)
Replace the character and reset any active animations/quizzes.

#### writer.quiz(options?)
Start an interactive drawing quiz.
- `onMistake(strokeData)` — called on incorrect stroke
- `onCorrectStroke(strokeData)` — called on correct stroke
- `onComplete(summaryData)` — called on quiz completion
- `showHintAfterMisses` (integer, default 3)
- `markStrokeCorrectAfterMisses` (integer, disabled)
- `quizStartStrokeNum` (integer, default 0)
- `acceptBackwardsStrokes` (boolean, default false)
- `leniency` (float, default 1.0)
- `highlightOnComplete` (boolean, default true)

#### writer.cancelQuiz()
Stop the current quiz immediately.

### Class Methods

#### HanziWriter.loadCharacterData(character, options?)
Load raw character stroke data. Returns a Promise resolving with a character data object containing a `strokes` array.

Options: `charDataLoader`, `onLoadCharDataSuccess`, `onLoadCharDataError`.

#### HanziWriter.getScalingTransform(width, height, padding?)
Calculate SVG transform for rendering character data.

Returns object with:
- `x` (number) — translate x offset
- `y` (number) — translate y offset
- `scale` (number) — scale multiplier
- `transform` (string) — SVG transform attribute value

---

## Repository References

- **Main:** https://github.com/chanind/hanzi-writer
- **Character Data:** https://github.com/chanind/hanzi-writer-data
- **CDN:** https://www.jsdelivr.com/package/npm/hanzi-writer
