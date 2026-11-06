# Sumspace Math Notebook

A small, browser-based notebook for math notes, live calculations, and reusable custom formulas. It is a static site with no build step or server-side account; GitHub Pages can host it directly.

## Publish on GitHub Pages

This project is a static site: `index.html`, `styles.css`, and `app.js` are served directly, so no build command is needed.

1. Create a GitHub repository and push these files to its `main` branch. Keep `index.html` at the repository root.
2. On GitHub, open the repository's **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, select `main` and `/(root)`, then save.
4. Wait for the deployment to finish. Open the URL shown in **Settings → Pages**. A project site usually has the form `https://YOUR-NAME.github.io/REPOSITORY/`.

After future pushes to the selected branch, GitHub Pages republishes the site. Notes and custom formulas are saved only in each visitor's browser; Pages does not sync or store them.

## Use

- Create and switch between notes from the notebook list. Changes save automatically in this browser.
- Enter calculations in the note on their own lines with `= ` at the start; results update as you type. For example: `= sqrt(81) + 2^3`.
- Use the calculator for scratch work. Press Enter to add its current expression to the note.
- Graph an expression in `x` and adjust the x range. Drag the graph to pan in both directions. Enter points as `x, y`, one per line (or separated by semicolons), then press **Plot** to show them with the curve.
- Add common algebra formulas from the built-in list: slope, midpoint coordinates, distance, point-slope form, linear equations, the discriminant, quadratic roots, and the x-coordinate of a quadratic's vertex. The references link to [Khan Academy Algebra](https://www.khanacademy.org/math/algebra) and [Math Is Fun's quadratic equation guide](https://www.mathsisfun.com/algebra/quadratic-equation.html).
- Add a formula with a name, comma-separated inputs, and a rule, such as `slope(x1, y1, x2, y2) = (y2 - y1) / (x2 - x1)`. Then use `= slope(2, 8, 3, 14)` in a note or the calculator.
- Open **Math helper** for a next-step hint that avoids giving the final answer. Ask it to add a formula using `add formula name(a, b) = expression`, or request a built-in suggestion such as the area of a circle.
- Built-in functions include `sin`, `cos`, `sqrt`, `abs`, `log`, `ln`, `exp`, `min`, `max`, `round`, `floor`, `ceil`, and `pow`. Angles are in radians; use `pi` and `e` for constants and `^` for powers.
- Use **Export notes** to download a backup, or **Import** to restore one.

Notes and formulas are stored in the browser's local storage, not synced to GitHub or between devices. Export a backup before clearing site data or changing browsers. The helper is a small, rule-based guide that runs locally, not a hosted language model; it does not send prompts or notes elsewhere. The app does not use JavaScript `eval` to calculate expressions.