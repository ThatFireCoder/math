(() => {
  const STORAGE_KEY = 'sumspace-v1';
  const builtins = {
    sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan,
    sqrt: Math.sqrt, abs: Math.abs, log: Math.log10, ln: Math.log, exp: Math.exp,
    min: Math.min, max: Math.max, round: Math.round, floor: Math.floor, ceil: Math.ceil,
    pow: Math.pow, sign: Math.sign
  };
  const $ = (selector) => document.querySelector(selector);
  const elements = {
    noteList: $('#note-list'), noteTitle: $('#note-title'), noteBody: $('#note-body'), noteDate: $('#note-date'),
    calculations: $('#note-calculations'), breadcrumb: $('#current-breadcrumb'), wordCount: $('#word-count'), saveStatus: $('#save-status'),
    calculatorInput: $('#calculator-input'), calculatorResult: $('#calculator-result'), copyResult: $('#copy-result'),
    graphForm: $('#graph-form'), graphExpression: $('#graph-expression'), graphMin: $('#graph-min'), graphMax: $('#graph-max'),
      graphCanvas: $('#graph-canvas'), graphPoints: $('#graph-points'), graphStatus: $('#graph-status'), coachDialog: $('#coach-dialog'), coachLog: $('#coach-log'),
    coachForm: $('#coach-form'), coachInput: $('#coach-input'),
    formulaList: $('#formula-list'), formulaEmpty: $('#formula-empty'), formulaCount: $('#formula-count'),
    dialog: $('#formula-dialog'), form: $('#formula-form'), dialogTitle: $('#dialog-title'), formulaName: $('#formula-name'),
    formulaParameters: $('#formula-parameters'), formulaExpression: $('#formula-expression'), formulaError: $('#formula-error'),
    toast: $('#toast')
  };
  let state = loadState();
  let editingFormula = null;
  let saveTimer;
  let toastTimer;
   let graphView = null;
   let graphDrag = null;

   const algebraFormulas = [
     { name: 'slope', parameters: ['x1', 'y1', 'x2', 'y2'], expression: '(y2 - y1) / (x2 - x1)' },
     { name: 'midpoint_x', parameters: ['x1', 'x2'], expression: '(x1 + x2) / 2' },
     { name: 'midpoint_y', parameters: ['y1', 'y2'], expression: '(y1 + y2) / 2' },
     { name: 'distance', parameters: ['x1', 'y1', 'x2', 'y2'], expression: 'sqrt((x2 - x1)^2 + (y2 - y1)^2)' },
     { name: 'point_slope', parameters: ['x', 'm', 'x1', 'y1'], expression: 'm * (x - x1) + y1' },
     { name: 'discriminant', parameters: ['a', 'b', 'c'], expression: 'b^2 - 4 * a * c' },
    { name: 'vertex_x', parameters: ['a', 'b'], expression: '-b / (2 * a)' },
    { name: 'quadratic_root_plus', parameters: ['a', 'b', 'c'], expression: '(-b + sqrt(b^2 - 4 * a * c)) / (2 * a)' },
    { name: 'quadratic_root_minus', parameters: ['a', 'b', 'c'], expression: '(-b - sqrt(b^2 - 4 * a * c)) / (2 * a)' },
    { name: 'linear_y', parameters: ['m', 'x', 'b'], expression: 'm * x + b' }
   ];

  function makeId() {
    return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved && Array.isArray(saved.notes) && Array.isArray(saved.formulas)) {
        const notes = saved.notes.filter((note) => note && typeof note.id === 'string').map((note) => ({
          id: note.id, title: String(note.title ?? ''), body: String(note.body ?? ''), updatedAt: Number(note.updatedAt) || Date.now()
        }));
        const formulas = saved.formulas.filter((formula) => formula && typeof formula.name === 'string');
        if (notes.length) return { notes, formulas, activeNoteId: notes.some((note) => note.id === saved.activeNoteId) ? saved.activeNoteId : notes[0].id };
      }
    } catch { /* Start with a fresh notebook if saved data is unreadable. */ }
    const note = { id: makeId(), title: 'Getting started', body: 'A place for working things out.\n\nWrite any thoughts or steps here. Calculator expressions begin with = on a line.\n\n= sqrt(81) + 2^3\n\nCreate a custom formula, then call it here or in the calculator.', updatedAt: Date.now() };
    return { notes: [note], formulas: [], activeNoteId: note.id };
  }

  function activeNote() {
    return state.notes.find((note) => note.id === state.activeNoteId) ?? state.notes[0];
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      elements.saveStatus.textContent = 'Saved on this device';
    } catch {
      elements.saveStatus.textContent = 'Could not save locally';
    }
  }

  function scheduleSave() {
    elements.saveStatus.textContent = 'Saving…';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveState, 180);
  }

  function displayDate(timestamp) {
    return new Intl.DateTimeFormat(undefined, { month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(timestamp));
  }

  function renderNotes() {
    elements.noteList.replaceChildren();
    state.notes.forEach((note) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `note-link${note.id === state.activeNoteId ? ' active' : ''}`;
      button.setAttribute('aria-current', note.id === state.activeNoteId ? 'page' : 'false');
      const icon = document.createElement('span');
      icon.className = 'note-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = '▤';
      const title = document.createElement('span');
      title.className = 'note-link-title';
      title.textContent = note.title.trim() || 'Untitled note';
      button.append(icon, title);
      button.addEventListener('click', () => {
        state.activeNoteId = note.id;
        renderActiveNote();
        renderNotes();
        scheduleSave();
      });
      elements.noteList.append(button);
    });
  }

  function updateWordCount() {
    const words = elements.noteBody.value.trim().match(/\S+/g)?.length ?? 0;
    elements.wordCount.textContent = `${words} ${words === 1 ? 'word' : 'words'}`;
  }

  function renderActiveNote() {
    const note = activeNote();
    if (!note) return;
    elements.noteTitle.value = note.title;
    elements.noteBody.value = note.body;
    elements.noteDate.textContent = `Last edited ${displayDate(note.updatedAt)}`;
    elements.breadcrumb.textContent = note.title.trim() || 'Untitled';
    updateWordCount();
    renderNoteCalculations();
  }

  function updateActiveNote() {
    const note = activeNote();
    if (!note) return;
    note.title = elements.noteTitle.value;
    note.body = elements.noteBody.value;
    note.updatedAt = Date.now();
    elements.breadcrumb.textContent = note.title.trim() || 'Untitled';
    elements.noteDate.textContent = `Last edited ${displayDate(note.updatedAt)}`;
    updateWordCount();
    renderNotes();
    renderNoteCalculations();
    scheduleSave();
  }

  function tokenize(source) {
    const tokens = [];
    let index = 0;
    while (index < source.length) {
      const char = source[index];
      if (/\s/.test(char)) { index += 1; continue; }
      const number = source.slice(index).match(/^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/);
      if (number) { tokens.push({ type: 'number', value: Number(number[0]) }); index += number[0].length; continue; }
      const identifier = source.slice(index).match(/^[a-zA-Z_][a-zA-Z_0-9]*/);
      if (identifier) { tokens.push({ type: 'identifier', value: identifier[0].toLowerCase() }); index += identifier[0].length; continue; }
      if ('+-*/%^(),'.includes(char)) { tokens.push({ type: char, value: char }); index += 1; continue; }
      throw new Error(`Unexpected character “${char}”`);
    }
    tokens.push({ type: 'eof', value: '' });
    return tokens;
  }

  function evaluate(source, variables = {}, formulaStack = []) {
    const tokens = tokenize(source);
    let position = 0;
    const current = () => tokens[position];
    const consume = (type) => {
      if (current().type !== type) throw new Error(`Expected “${type === 'eof' ? 'end of expression' : type}”`);
      return tokens[position++];
    };
    const expression = () => {
      let value = term();
      while (current().type === '+' || current().type === '-') {
        const operator = tokens[position++].type;
        const right = term();
        value = operator === '+' ? value + right : value - right;
      }
      return value;
    };
    const term = () => {
      let value = unary();
      while (['*', '/', '%'].includes(current().type)) {
        const operator = tokens[position++].type;
        const right = unary();
        if ((operator === '/' || operator === '%') && right === 0) throw new Error('Cannot divide by zero');
        value = operator === '*' ? value * right : operator === '/' ? value / right : value % right;
      }
      return value;
    };
    const unary = () => {
      if (current().type === '+') { position += 1; return unary(); }
      if (current().type === '-') { position += 1; return -unary(); }
      return power();
    };
    const power = () => {
      let value = primary();
      if (current().type === '^') { position += 1; value **= unary(); }
      return value;
    };
    const primary = () => {
      if (current().type === 'number') return consume('number').value;
      if (current().type === '(') {
        consume('(');
        const value = expression();
        consume(')');
        return value;
      }
      if (current().type === 'identifier') {
        const name = consume('identifier').value;
        if (current().type === '(') {
          consume('(');
          const args = [];
          if (current().type !== ')') {
            args.push(expression());
            while (current().type === ',') { consume(','); args.push(expression()); }
          }
          consume(')');
          return callFunction(name, args, variables, formulaStack);
        }
        if (Object.hasOwn(variables, name)) return variables[name];
        if (name === 'pi') return Math.PI;
        if (name === 'e') return Math.E;
        throw new Error(`Unknown value “${name}”`);
      }
      throw new Error('Expected a number, value, or parenthesis');
    };

    const result = expression();
    consume('eof');
    if (!Number.isFinite(result)) throw new Error('Result is not a finite number');
    return result;
  }

  function callFunction(name, args, variables, formulaStack) {
    if (Object.hasOwn(builtins, name)) {
      const result = builtins[name](...args);
      if (!Number.isFinite(result)) throw new Error(`${name} produced an invalid result`);
      return result;
    }
    const formula = state.formulas.find((item) => item.name === name);
    if (!formula) throw new Error(`Unknown function “${name}”`);
    if (formulaStack.includes(name)) throw new Error(`Circular formula: ${[...formulaStack, name].join(' → ')}`);
    if (args.length !== formula.parameters.length) throw new Error(`${name} needs ${formula.parameters.length} input${formula.parameters.length === 1 ? '' : 's'}`);
    const formulaVariables = Object.fromEntries(formula.parameters.map((parameter, index) => [parameter, args[index]]));
    return evaluate(formula.expression, formulaVariables, [...formulaStack, name]);
  }

  function drawGraph() {
    const canvas = elements.graphCanvas;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const context = canvas.getContext('2d');
    const expression = elements.graphExpression.value.trim();
    const xMin = Number(elements.graphMin.value);
    const xMax = Number(elements.graphMax.value);
    elements.graphStatus.classList.remove('error');
    if (!context || !width || !height) return;
    if (!expression) return setGraphError('Enter an expression in x.');
    if (!Number.isFinite(xMin) || !Number.isFinite(xMax) || xMin >= xMax) return setGraphError('Choose a minimum x smaller than the maximum.');
    let plottedPoints;
    try { plottedPoints = parseGraphPoints(elements.graphPoints.value); }
    catch (error) { return setGraphError(error.message); }

    const pixelRatio = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, width, height);

    const padding = { left: 42, right: 9, top: 10, bottom: 23 };
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;
    const samples = Math.min(1200, Math.max(300, Math.floor(plotWidth * 1.5)));
    const points = [];
    const validValues = [];
    for (let index = 0; index <= samples; index += 1) {
      const x = xMin + (xMax - xMin) * index / samples;
      let y = null;
      try {
        const value = evaluate(expression, { x });
        if (Math.abs(value) <= 1e9) {
          y = value;
          validValues.push(value);
        }
      } catch { /* Leave gaps where the expression is undefined. */ }
      points.push({ x, y });
    }
    if (!validValues.length) return setGraphError('No real values in this x range.');

    const allYValues = [...validValues, ...plottedPoints.map((point) => point.y)];
    if (!graphView) {
      let yMin = Math.min(...allYValues);
      let yMax = Math.max(...allYValues);
      if (yMin === yMax) { yMin -= 1; yMax += 1; }
      const yPadding = (yMax - yMin) * 0.08;
      graphView = { xMin, xMax, yMin: yMin - yPadding, yMax: yMax + yPadding };
    }
    const view = graphView;
    const mapX = (x) => padding.left + (x - view.xMin) / (view.xMax - view.xMin) * plotWidth;
    const mapY = (y) => padding.top + (view.yMax - y) / (view.yMax - view.yMin) * plotHeight;

    context.font = '9px "DM Mono", monospace';
    context.textBaseline = 'middle';
    for (let tick = 0; tick <= 5; tick += 1) {
      const x = view.xMin + (view.xMax - view.xMin) * tick / 5;
      const px = mapX(x);
      context.strokeStyle = Math.abs(x) < (view.xMax - view.xMin) / 1000 ? '#bfc8bc' : '#eceee7';
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(px, padding.top);
      context.lineTo(px, padding.top + plotHeight);
      context.stroke();
      context.fillStyle = '#90988d';
      context.textAlign = tick === 0 ? 'left' : tick === 5 ? 'right' : 'center';
      context.fillText(Number(x.toPrecision(3)).toString(), px, height - 11);

      const y = view.yMin + (view.yMax - view.yMin) * tick / 5;
      const py = mapY(y);
      context.strokeStyle = Math.abs(y) < (view.yMax - view.yMin) / 1000 ? '#bfc8bc' : '#eceee7';
      context.beginPath();
      context.moveTo(padding.left, py);
      context.lineTo(padding.left + plotWidth, py);
      context.stroke();
      context.fillStyle = '#90988d';
      context.textAlign = 'right';
      context.fillText(Number(y.toPrecision(3)).toString(), padding.left - 6, py);
    }

    context.save();
    context.beginPath();
    context.rect(padding.left, padding.top, plotWidth, plotHeight);
    context.clip();
    context.strokeStyle = '#37634d';
    context.lineWidth = 2;
    context.lineJoin = 'round';
    context.beginPath();
    let drawing = false;
    let previousY = null;
    for (const point of points) {
      if (point.y === null || (previousY !== null && Math.abs(point.y - previousY) > (view.yMax - view.yMin) * 0.7)) {
        drawing = false;
        previousY = point.y;
        continue;
      }
      const px = mapX(point.x);
      const py = mapY(point.y);
      if (!drawing) { context.moveTo(px, py); drawing = true; }
      else context.lineTo(px, py);
      previousY = point.y;
    }
    context.stroke();
    for (const point of plottedPoints) {
      const px = mapX(point.x);
      const py = mapY(point.y);
      if (px < padding.left || px > padding.left + plotWidth || py < padding.top || py > padding.top + plotHeight) continue;
      context.beginPath();
      context.arc(px, py, 4, 0, Math.PI * 2);
      context.fillStyle = '#c16f54';
      context.fill();
      context.strokeStyle = '#fffefa';
      context.lineWidth = 1.5;
      context.stroke();
    }
    context.restore();
    elements.graphMin.value = Number(view.xMin.toPrecision(6));
    elements.graphMax.value = Number(view.xMax.toPrecision(6));
    canvas.setAttribute('aria-label', `Graph of y = ${expression} with ${plottedPoints.length} plotted points`);
    elements.graphStatus.textContent = `${plottedPoints.length} point${plottedPoints.length === 1 ? '' : 's'} · drag to pan · y ${Number(view.yMin.toPrecision(3))} to ${Number(view.yMax.toPrecision(3))}`;
  }

  function parseGraphPoints(source) {
    if (!source.trim()) return [];
    return source.split(/[\n;]+/).map((entry) => {
      const parts = entry.trim().replace(/^\(|\)$/g, '').split(',');
      const coordinates = parts.map((coordinate) => Number(coordinate.trim()));
      if (coordinates.length !== 2 || parts.some((coordinate) => !coordinate.trim()) || coordinates.some((coordinate) => !Number.isFinite(coordinate))) {
        throw new Error('Enter points as x, y, one point per line (or separated by semicolons).');
      }
      return { x: coordinates[0], y: coordinates[1] };
    });
  }

  function setGraphError(message) {
    elements.graphStatus.textContent = message;
    elements.graphStatus.classList.add('error');
  }

  function renderNoteCalculations() {
    const source = elements.noteBody.value;
    const matches = [...source.matchAll(/^\s*=\s*(.+?)\s*$/gm)];
    elements.calculations.replaceChildren();
    matches.forEach((match) => {
      const row = document.createElement('div');
      row.className = 'note-calculation';
      const expression = document.createElement('span');
      expression.className = 'note-calculation-expression';
      expression.textContent = `= ${match[1]}`;
      const result = document.createElement('span');
      result.className = 'note-calculation-result';
      try {
        result.textContent = new Intl.NumberFormat(undefined, { maximumSignificantDigits: 12 }).format(evaluate(match[1]));
      } catch (error) {
        result.classList.add('error');
        result.textContent = error.message;
      }
      row.append(expression, result);
      elements.calculations.append(row);
    });
  }

  function updateCalculator() {
    const expression = elements.calculatorInput.value.trim();
    if (!expression) {
      elements.calculatorResult.textContent = 'Your answer appears here';
      elements.calculatorResult.classList.remove('error');
      elements.copyResult.disabled = true;
      return;
    }
    try {
      const answer = evaluate(expression);
      elements.calculatorResult.textContent = new Intl.NumberFormat(undefined, { maximumSignificantDigits: 12 }).format(answer);
      elements.calculatorResult.classList.remove('error');
      elements.copyResult.disabled = false;
    } catch (error) {
      elements.calculatorResult.textContent = error.message;
      elements.calculatorResult.classList.add('error');
      elements.copyResult.disabled = true;
    }
  }

  function renderFormulas() {
    elements.formulaCount.textContent = String(state.formulas.length);
    elements.formulaEmpty.hidden = state.formulas.length > 0;
    elements.formulaList.replaceChildren();
    state.formulas.forEach((formula) => {
      const item = document.createElement('article');
      item.className = 'formula-item';
      const top = document.createElement('div');
      top.className = 'formula-item-top';
      const name = document.createElement('span');
      name.className = 'formula-name';
      name.textContent = `${formula.name}()`;
      const args = document.createElement('span');
      args.className = 'formula-args';
      args.textContent = formula.parameters.join(', ');
      const actions = document.createElement('div');
      actions.className = 'formula-actions';
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.textContent = 'Edit';
      edit.addEventListener('click', () => openFormulaDialog(formula));
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'delete-formula';
      remove.textContent = 'Delete';
      remove.addEventListener('click', () => {
        state.formulas = state.formulas.filter((itemFormula) => itemFormula.name !== formula.name);
        renderFormulas();
        updateCalculator();
        scheduleSave();
        showToast(`Deleted ${formula.name}()`);
      });
      actions.append(edit, remove);
      top.append(name, args, actions);
      const rule = document.createElement('div');
      rule.className = 'formula-rule';
      rule.textContent = `= ${formula.expression}`;
      item.append(top, rule);
      elements.formulaList.append(item);
    });
  }

  function openFormulaDialog(formula = null) {
    editingFormula = formula?.name ?? null;
    elements.dialogTitle.textContent = formula ? 'Edit formula' : 'Make a formula';
    elements.formulaName.value = formula?.name ?? '';
    elements.formulaParameters.value = formula?.parameters.join(', ') ?? '';
    elements.formulaExpression.value = formula?.expression ?? '';
    elements.formulaError.textContent = '';
    elements.dialog.showModal();
    elements.formulaName.focus();
  }

  function parseFormulaForm() {
    const name = elements.formulaName.value.trim().toLowerCase();
    const parameters = elements.formulaParameters.value.split(',').map((parameter) => parameter.trim().toLowerCase()).filter(Boolean);
    const expression = elements.formulaExpression.value.trim();
    if (!/^[a-z][a-z0-9_]*$/.test(name)) throw new Error('Use a lowercase name starting with a letter.');
    if (Object.hasOwn(builtins, name) || ['pi', 'e'].includes(name)) throw new Error('That name is reserved for a built-in value or function.');
    if (new Set(parameters).size !== parameters.length || parameters.some((parameter) => !/^[a-z][a-z0-9_]*$/.test(parameter))) throw new Error('Inputs must be unique names starting with a letter.');
    if (parameters.includes(name)) throw new Error('A formula cannot use its own name as an input.');
    if (!expression) throw new Error('Add a rule for this formula.');
    if (state.formulas.some((formula) => formula.name === name && formula.name !== editingFormula)) throw new Error('A formula with that name already exists.');
    evaluate(expression, Object.fromEntries(parameters.map((parameter, index) => [parameter, index + 2])));
    return { name, parameters, expression };
  }

  function addAlgebraFormula(formula) {
    if (state.formulas.some((item) => item.name === formula.name)) {
      showToast(`${formula.name}() is already in your formulas`);
      return;
    }
    state.formulas.push(formula);
    state.formulas.sort((a, b) => a.name.localeCompare(b.name));
    renderFormulas();
    updateCalculator();
    renderNoteCalculations();
    scheduleSave();
    showToast(`Added ${formula.name}()`);
  }

  function renderAlgebraFormulas() {
    const list = $('#algebra-formula-list');
    list.replaceChildren();
    algebraFormulas.forEach((formula) => {
      const row = document.createElement('div');
      row.className = 'algebra-formula-item';
      const description = document.createElement('div');
      const name = document.createElement('strong');
      name.textContent = `${formula.name}(${formula.parameters.join(', ')})`;
      const rule = document.createElement('code');
      rule.textContent = formula.expression;
      description.append(name, rule);
      const add = document.createElement('button');
      add.type = 'button';
      add.className = 'text-button';
      add.textContent = 'Add';
      add.setAttribute('aria-label', `Add ${formula.name} formula`);
      add.addEventListener('click', () => addAlgebraFormula(formula));
      row.append(description, add);
      list.append(row);
    });
  }

  function appendCoachMessage(text, role) {
    const message = document.createElement('div');
    message.className = `coach-message ${role}-message`;
    message.textContent = text;
    elements.coachLog.append(message);
    elements.coachLog.scrollTop = elements.coachLog.scrollHeight;
  }

  function coachFormulaRequest(text) {
    const declaration = text.match(/\b(?:add|create|save)\s+(?:a\s+)?formula\s+([a-z][a-z0-9_]*)\s*\(([^)]*)\)\s*=\s*(.+)$/i);
    if (declaration) return { name: declaration[1], parameters: declaration[2], expression: declaration[3] };
    if (!/\b(?:add|create|save)\b/i.test(text) || !/\bformula\b/i.test(text)) return null;
    const templates = [
      { pattern: /\barea of (?:a )?circle\b|\bcircle area\b/i, name: 'circle_area', parameters: 'r', expression: 'pi * r^2' },
      { pattern: /\bcircumference of (?:a )?circle\b|\bcircle circumference\b/i, name: 'circle_circumference', parameters: 'r', expression: '2 * pi * r' },
      { pattern: /\bslope between two points\b/i, name: 'slope', parameters: 'x1, y1, x2, y2', expression: '(y2 - y1) / (x2 - x1)' },
      { pattern: /\bdistance between two points\b/i, name: 'distance', parameters: 'x1, y1, x2, y2', expression: 'sqrt((x2 - x1)^2 + (y2 - y1)^2)' }
    ];
    return templates.find((template) => template.pattern.test(text)) ?? { needsDetails: true };
  }

  function addCoachFormula(definition) {
    if (definition.needsDetails) return 'Tell me the formula name, its inputs, and its rule. For example: add formula triple(x) = 3 * x.';
    elements.formulaName.value = definition.name;
    elements.formulaParameters.value = definition.parameters;
    elements.formulaExpression.value = definition.expression;
    editingFormula = null;
    const formula = parseFormulaForm();
    state.formulas.push(formula);
    state.formulas.sort((a, b) => a.name.localeCompare(b.name));
    renderFormulas();
    updateCalculator();
    renderNoteCalculations();
    drawGraph();
    scheduleSave();
    return `Added ${formula.name}(${formula.parameters.join(', ')}) = ${formula.expression}. What values would you like to try with it?`;
  }

  function coachHint(text) {
    const prompt = text.toLowerCase();
    if (/\bslope\b|\bgradient\b/.test(prompt)) return 'Think about change in y divided by change in x. Which two points are you comparing, and what is the vertical change for each horizontal step?';
    if (/\bquadratic\b|\bparabola\b/.test(prompt)) return 'First put the expression in ax^2 + bx + c = 0 form. Can you identify a, b, and c, then find the discriminant b^2 - 4ac?';
    if (/\bfactor|\bcommon factor/.test(prompt)) return 'Start by checking whether every term shares a factor. After taking it out, what simpler expression remains inside the parentheses?';
    if (/\bgraph|\bintercept|\bvertex/.test(prompt)) return 'Choose a few x-values and notice how y changes. What do the intercepts or turning point tell you about the expression?';
    if (/\barea|\bperimeter|\bcircumference|\bgeometry|\bshape/.test(prompt)) return 'Name the shape and list the measurements you know. Which relationship connects those measurements to what you are trying to find?';
    if (/\bformula\b/.test(prompt)) return 'What quantities go into the relationship, and what connects them? You can save it by writing: add formula name(a, b) = expression.';
    if (/\banswer|\bcalculate|\bsolve|\bwhat is\b/.test(prompt)) return 'I won’t give the final answer. What is the first operation or relationship you think applies? Tell me your first step and I’ll help you check the approach.';
    return 'What are you trying to find, and what have you tried so far? I can suggest one next step without giving away the result.';
  }

  function respondToCoach(text) {
    const request = coachFormulaRequest(text);
    if (request) {
      try { return addCoachFormula(request); }
      catch (error) { return `I couldn’t save that formula yet: ${error.message} Check the input names and rule, then try again.`; }
    }
    return coachHint(text);
  }

  function showToast(message) {
    elements.toast.textContent = message;
    elements.toast.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => elements.toast.classList.remove('visible'), 2100);
  }

  function createNote() {
    const note = { id: makeId(), title: '', body: '', updatedAt: Date.now() };
    state.notes.unshift(note);
    state.activeNoteId = note.id;
    renderNotes();
    renderActiveNote();
    scheduleSave();
    elements.noteTitle.focus();
  }

  function exportNotes() {
    const blob = new Blob([JSON.stringify({ version: 1, notes: state.notes, formulas: state.formulas, activeNoteId: state.activeNoteId }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'sumspace-notes.json';
    link.click();
    URL.revokeObjectURL(url);
    showToast('Notebook backup downloaded');
  }

  async function importNotes(file) {
    try {
      const imported = JSON.parse(await file.text());
      if (!Array.isArray(imported.notes) || !Array.isArray(imported.formulas)) throw new Error('This file is not a Sumspace backup.');
      const notes = imported.notes.filter((note) => note && typeof note.title === 'string' && typeof note.body === 'string').map((note) => ({
        id: typeof note.id === 'string' ? note.id : makeId(), title: note.title, body: note.body, updatedAt: Number(note.updatedAt) || Date.now()
      }));
      const formulas = imported.formulas.filter((formula) => formula && /^[a-z][a-z0-9_]*$/.test(formula.name) && Array.isArray(formula.parameters) && typeof formula.expression === 'string');
      if (!notes.length) throw new Error('No valid notes were found in this backup.');
      const names = new Set();
      for (const formula of formulas) {
        if (names.has(formula.name) || Object.hasOwn(builtins, formula.name) || ['pi', 'e'].includes(formula.name)) throw new Error('The backup contains conflicting formula names.');
        names.add(formula.name);
      }
      state = { notes, formulas, activeNoteId: notes.some((note) => note.id === imported.activeNoteId) ? imported.activeNoteId : notes[0].id };
      renderNotes();
      renderActiveNote();
      renderFormulas();
      saveState();
      showToast('Notebook backup restored');
    } catch (error) {
      showToast(error.message || 'Could not read that backup');
    }
  }

  $('#add-note').addEventListener('click', createNote);
  $('#open-coach').addEventListener('click', () => {
    elements.coachDialog.showModal();
    elements.coachInput.focus();
  });
  $('#close-coach').addEventListener('click', () => elements.coachDialog.close());
  elements.coachForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const message = elements.coachInput.value.trim();
    if (!message) return;
    appendCoachMessage(message, 'user');
    appendCoachMessage(respondToCoach(message), 'assistant');
    elements.coachInput.value = '';
    elements.coachInput.focus();
  });
  $('#add-formula').addEventListener('click', () => openFormulaDialog());
  $('#create-first-formula').addEventListener('click', () => openFormulaDialog());
  $('#close-dialog').addEventListener('click', () => elements.dialog.close());
  $('#cancel-formula').addEventListener('click', () => elements.dialog.close());
  elements.noteTitle.addEventListener('input', updateActiveNote);
  elements.noteBody.addEventListener('input', updateActiveNote);
  elements.calculatorInput.addEventListener('input', updateCalculator);
  elements.graphForm.addEventListener('submit', (event) => {
    event.preventDefault();
    graphView = null;
    drawGraph();
  });
  elements.graphCanvas.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || !graphView) return;
    const bounds = elements.graphCanvas.getBoundingClientRect();
    graphDrag = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      width: bounds.width - 51,
      height: bounds.height - 33,
      view: { ...graphView }
    };
    elements.graphCanvas.setPointerCapture(event.pointerId);
  });
  elements.graphCanvas.addEventListener('pointermove', (event) => {
    if (!graphDrag || event.pointerId !== graphDrag.pointerId) return;
    const dx = event.clientX - graphDrag.x;
    const dy = event.clientY - graphDrag.y;
    const xShift = dx / graphDrag.width * (graphDrag.view.xMax - graphDrag.view.xMin);
    const yShift = dy / graphDrag.height * (graphDrag.view.yMax - graphDrag.view.yMin);
    graphView = {
      xMin: graphDrag.view.xMin - xShift,
      xMax: graphDrag.view.xMax - xShift,
      yMin: graphDrag.view.yMin - yShift,
      yMax: graphDrag.view.yMax - yShift
    };
    drawGraph();
  });
  const endGraphDrag = (event) => {
    if (graphDrag?.pointerId === event.pointerId) graphDrag = null;
  };
  elements.graphCanvas.addEventListener('pointerup', endGraphDrag);
  elements.graphCanvas.addEventListener('pointercancel', endGraphDrag);
  elements.calculatorInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !elements.calculatorResult.classList.contains('error')) {
      const line = `= ${elements.calculatorInput.value.trim()}`;
      const start = elements.noteBody.selectionStart;
      const before = elements.noteBody.value.slice(0, start);
      const after = elements.noteBody.value.slice(start);
      const prefix = before && !before.endsWith('\n') ? '\n' : '';
      const suffix = after && !after.startsWith('\n') ? '\n' : '';
      elements.noteBody.setRangeText(`${prefix}${line}${suffix}`, start, start, 'end');
      updateActiveNote();
      elements.noteBody.focus();
      showToast('Calculation added to note');
    }
  });
  elements.copyResult.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(elements.calculatorResult.textContent);
      showToast('Answer copied');
    } catch { showToast('Clipboard access is unavailable'); }
  });
  elements.form.addEventListener('submit', (event) => {
    event.preventDefault();
    try {
      const formula = parseFormulaForm();
      if (editingFormula && editingFormula !== formula.name) state.formulas = state.formulas.filter((item) => item.name !== editingFormula);
      const existing = state.formulas.findIndex((item) => item.name === formula.name);
      if (existing < 0) state.formulas.push(formula);
      else state.formulas[existing] = formula;
      state.formulas.sort((a, b) => a.name.localeCompare(b.name));
      elements.dialog.close();
      renderFormulas();
      updateCalculator();
      scheduleSave();
      showToast(`${formula.name}() is ready to use`);
    } catch (error) {
      elements.formulaError.textContent = error.message;
    }
  });
  $('#export-notes').addEventListener('click', exportNotes);
  $('#import-trigger').addEventListener('click', () => $('#import-file').click());
  $('#import-file').addEventListener('change', (event) => {
    const file = event.target.files?.[0];
    if (file) importNotes(file);
    event.target.value = '';
  });

  renderNotes();
  renderActiveNote();
  renderFormulas();
  renderAlgebraFormulas();
  drawGraph();
  if ('ResizeObserver' in window) new ResizeObserver(drawGraph).observe(elements.graphCanvas);
  else window.addEventListener('resize', drawGraph);
  saveState();
})();