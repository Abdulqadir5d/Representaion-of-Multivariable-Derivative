// === GLOBAL STATE AND CONFIGURATION ===
const AppState = {
  currentFunction: 'x^2 + y^2',
  x0: 1,
  y0: 2,
  isDarkMode: false,
  plotVisibility: {
    surface: true,
    tangentPlane: true,
    gradient: true,
    contour: true,
    vectors: true
  },
  cachedPlots: new Map(),
  isLoading: false
};

// === UTILITY FUNCTIONS ===
const Utils = {
  // Debounce function for performance
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  // Show loading overlay
  showLoading() {
    AppState.isLoading = true;
    document.getElementById('loadingOverlay').style.display = 'flex';
  },

  // Hide loading overlay
  hideLoading() {
    AppState.isLoading = false;
    document.getElementById('loadingOverlay').style.display = 'none';
  },

  // Show error message
  showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #ef4444;
      color: white;
      padding: 1rem;
      border-radius: 0.5rem;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      z-index: 10001;
      animation: slideIn 0.3s ease-out;
    `;
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
      errorDiv.style.animation = 'slideOut 0.3s ease-in forwards';
      setTimeout(() => errorDiv.remove(), 300);
    }, 5000);
  },

  // Validate mathematical expression
  validateExpression(expr) {
    try {
      const parsed = math.parse(expr);
      // Test with sample values
      const testValues = { x: 1, y: 1 };
      parsed.evaluate(testValues);
      return { valid: true, parsed };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  },

  // Format number for display
  formatNumber(num, decimals = 2) {
    if (Math.abs(num) < 0.001) return '0';
    return num.toFixed(decimals);
  }
};

// === THEME MANAGEMENT ===
const ThemeManager = {
  init() {
    // Check for saved theme preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      AppState.isDarkMode = savedTheme === 'dark';
    } else {
      // Check system preference
      AppState.isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    
    this.applyTheme();
    this.setupEventListeners();
  },

  applyTheme() {
    document.documentElement.setAttribute('data-theme', AppState.isDarkMode ? 'dark' : 'light');
    const themeIcon = document.querySelector('.theme-icon');
    if (themeIcon) {
      themeIcon.textContent = AppState.isDarkMode ? '☀️' : '🌙';
    }
  },

  toggleTheme() {
    AppState.isDarkMode = !AppState.isDarkMode;
    this.applyTheme();
    localStorage.setItem('theme', AppState.isDarkMode ? 'dark' : 'light');
    
    // Re-render plots with new theme
    if (AppState.currentFunction) {
      plotFunction();
    }
  },

  setupEventListeners() {
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
      themeToggle.addEventListener('click', () => this.toggleTheme());
    }
  }
};

// === PLOT MANAGEMENT ===
const PlotManager = {
  // Generate 3D plot data
  generate3DPlotData(expr, x0, y0) {
    try {
      const f = math.parse(expr);
      const fx = math.derivative(f, 'x');
      const fy = math.derivative(f, 'y');
      const fEval = f.compile();
      const fxEval = fx.compile();
      const fyEval = fy.compile();

      const range = math.range(-5, 5, 0.25).toArray();
      const xVals = range;
      const yVals = range;
      const zVals = xVals.map(x => yVals.map(y => fEval.evaluate({ x, y })));

      const fx0 = fxEval.evaluate({ x: x0, y: y0 });
      const fy0 = fyEval.evaluate({ x: x0, y: y0 });
      const f0 = fEval.evaluate({ x: x0, y: y0 });

      // Tangent plane
      const tangentZ = xVals.map(x =>
        yVals.map(y => f0 + fx0 * (x - x0) + fy0 * (y - y0))
      );

      return {
        surface: {
          x: xVals,
          y: yVals,
          z: zVals,
          type: 'surface',
          name: 'f(x,y)',
          colorscale: AppState.isDarkMode ? 'Viridis' : 'Blues',
          visible: AppState.plotVisibility.surface
        },
        tangentPlane: {
          x: xVals,
          y: yVals,
          z: tangentZ,
          type: 'surface',
          name: 'Tangent Plane',
          opacity: 0.6,
          colorscale: AppState.isDarkMode ? 'YlOrRd' : 'Reds',
          showscale: false,
          visible: AppState.plotVisibility.tangentPlane
        },
        point: {
          x: [x0],
          y: [y0],
          z: [f0],
          mode: 'markers',
          type: 'scatter3d',
          marker: { size: 8, color: '#ef4444' },
          name: `(${Utils.formatNumber(x0)}, ${Utils.formatNumber(y0)})`,
          visible: true
        },
        gradient: {
          x: [x0, x0 + fx0 / 2],
          y: [y0, y0 + fy0 / 2],
          z: [f0, f0 + (fx0 + fy0) / 2],
          mode: 'lines',
          type: 'scatter3d',
          line: { width: 6, color: '#ef4444' },
          name: 'Gradient',
          visible: AppState.plotVisibility.gradient
        },
        derivatives: { fx0, fy0, f0, fx, fy }
      };
    } catch (error) {
      throw new Error(`Error generating 3D plot: ${error.message}`);
    }
  },

  // Generate 2D plot data
  generate2DPlotData(expr, x0, y0) {
    try {
      const f = math.parse(expr);
      const fx = math.derivative(f, 'x');
      const fy = math.derivative(f, 'y');
      const fEval = f.compile();
      const fxEval = fx.compile();
      const fyEval = fy.compile();

      const gridStep = 0.5;
      const xs = math.range(-5, 5, gridStep).toArray();
      const ys = math.range(-5, 5, gridStep).toArray();

      // Gradient field vectors
      const vectors = [];
      const contourZ = xs.map(x => ys.map(y => fEval.evaluate({ x, y })));

      xs.forEach(x => {
        ys.forEach(y => {
          const gx = fxEval.evaluate({ x, y });
          const gy = fyEval.evaluate({ x, y });
          vectors.push({
            x: [x, x + 0.2 * gx],
            y: [y, y + 0.2 * gy],
            mode: 'lines',
            type: 'scatter',
            line: { color: '#1e293b', width: 1 },
            showlegend: false,
            visible: AppState.plotVisibility.vectors
          });
        });
      });

      return {
        contour: {
          x: xs,
          y: ys,
          z: contourZ,
          type: 'contour',
          contours: { coloring: 'heatmap' },
          showscale: false,
          visible: AppState.plotVisibility.contour
        },
        vectors
      };
    } catch (error) {
      throw new Error(`Error generating 2D plot: ${error.message}`);
    }
  },

  // Render 3D plot
  async render3DPlot(plotData) {
    const traces = [
      plotData.surface,
      plotData.tangentPlane,
      plotData.point,
      plotData.gradient
    ].filter(trace => trace.visible);

    const layout = {
      scene: {
        xaxis: { title: 'x', color: AppState.isDarkMode ? '#f8fafc' : '#1e293b' },
        yaxis: { title: 'y', color: AppState.isDarkMode ? '#f8fafc' : '#1e293b' },
        zaxis: { title: 'z', color: AppState.isDarkMode ? '#f8fafc' : '#1e293b' },
        bgcolor: AppState.isDarkMode ? '#0f172a' : '#ffffff'
      },
      margin: { t: 0, l: 0, r: 0, b: 0 },
      paper_bgcolor: 'transparent',
      plot_bgcolor: 'transparent',
      font: { color: AppState.isDarkMode ? '#f8fafc' : '#1e293b' }
    };

    await Plotly.newPlot('plot3d', traces, layout, { responsive: true });
  },

  // Render 2D plot
  async render2DPlot(plotData) {
    const traces = [plotData.contour, ...plotData.vectors].filter(trace => trace.visible);

    const layout = {
      xaxis: { 
        title: 'x', 
        color: AppState.isDarkMode ? '#f8fafc' : '#1e293b',
        gridcolor: AppState.isDarkMode ? '#334155' : '#e2e8f0'
      },
      yaxis: { 
        title: 'y', 
        color: AppState.isDarkMode ? '#f8fafc' : '#1e293b',
        gridcolor: AppState.isDarkMode ? '#334155' : '#e2e8f0'
      },
      margin: { t: 40, l: 40, r: 40, b: 40 },
      paper_bgcolor: 'transparent',
      plot_bgcolor: 'transparent',
      font: { color: AppState.isDarkMode ? '#f8fafc' : '#1e293b' },
      title: {
        text: '2D Contour & Gradient Field',
        font: { size: 16, color: AppState.isDarkMode ? '#f8fafc' : '#1e293b' }
      }
    };

    await Plotly.newPlot('plot2d', traces, layout, { responsive: true });
  }
};

// === MAIN PLOTTING FUNCTION ===
async function plotFunction() {
  try {
    Utils.showLoading();
    
    const expr = document.getElementById('func').value.trim();
    const x0 = parseFloat(document.getElementById('x0').value);
    const y0 = parseFloat(document.getElementById('y0').value);

    // Validate input
    if (!expr) {
      throw new Error('Please enter a function');
    }

    const validation = Utils.validateExpression(expr);
    if (!validation.valid) {
      throw new Error(`Invalid function: ${validation.error}`);
    }

    // Update state
    AppState.currentFunction = expr;
    AppState.x0 = x0;
    AppState.y0 = y0;

    // Generate plot data
    const plot3dData = PlotManager.generate3DPlotData(expr, x0, y0);
    const plot2dData = PlotManager.generate2DPlotData(expr, x0, y0);

    // Render plots
    await Promise.all([
      PlotManager.render3DPlot(plot3dData),
      PlotManager.render2DPlot(plot2dData)
    ]);

    // Update analysis section
    updateAnalysisSection(plot3dData.derivatives, x0, y0);

    // Cache the plot
    const cacheKey = `${expr}_${x0}_${y0}_${AppState.isDarkMode}`;
    AppState.cachedPlots.set(cacheKey, { plot3dData, plot2dData });

  } catch (error) {
    Utils.showError(error.message);
    console.error('Plot error:', error);
  } finally {
    Utils.hideLoading();
  }
}

// === ANALYSIS SECTION UPDATE ===
function updateAnalysisSection(derivatives, x0, y0) {
  const { fx0, fy0, f0, fx, fy } = derivatives;
  
  const analysisHTML = `
    <div class="analysis-grid">
      <div class="analysis-item">
        <h4>Partial Derivatives</h4>
        <p>\\( f_x = ${fx.toString()} \\)</p>
        <p>\\( f_y = ${fy.toString()} \\)</p>
      </div>
      <div class="analysis-item">
        <h4>At Point (${Utils.formatNumber(x0)}, ${Utils.formatNumber(y0)})</h4>
        <p>\\( f(${Utils.formatNumber(x0)}, ${Utils.formatNumber(y0)}) = ${Utils.formatNumber(f0)} \\)</p>
        <p>\\( f_x(${Utils.formatNumber(x0)}, ${Utils.formatNumber(y0)}) = ${Utils.formatNumber(fx0)} \\)</p>
        <p>\\( f_y(${Utils.formatNumber(x0)}, ${Utils.formatNumber(y0)}) = ${Utils.formatNumber(fy0)} \\)</p>
      </div>
      <div class="analysis-item">
        <h4>Gradient Vector</h4>
        <p>\\( \\nabla f(${Utils.formatNumber(x0)}, ${Utils.formatNumber(y0)}) = (${Utils.formatNumber(fx0)}, ${Utils.formatNumber(fy0)}) \\)</p>
        <p>\\( |\\nabla f| = ${Utils.formatNumber(Math.sqrt(fx0*fx0 + fy0*fy0))} \\)</p>
      </div>
    </div>
  `;
  
  document.getElementById('info').innerHTML = analysisHTML;
  
  // Re-render MathJax
  if (window.MathJax) {
    MathJax.typeset();
  }
}

// === CONTROL FUNCTIONS ===
function updateLabels() {
  const x0Value = document.getElementById('x0').value;
  const y0Value = document.getElementById('y0').value;
  
  document.getElementById('x0Label').textContent = Utils.formatNumber(parseFloat(x0Value));
  document.getElementById('y0Label').textContent = Utils.formatNumber(parseFloat(y0Value));
}

// === PLOT VISIBILITY TOGGLES ===
function toggleSurface() {
  AppState.plotVisibility.surface = !AppState.plotVisibility.surface;
  plotFunction();
}

function togglePlane() {
  AppState.plotVisibility.tangentPlane = !AppState.plotVisibility.tangentPlane;
  plotFunction();
}

function toggleGradient() {
  AppState.plotVisibility.gradient = !AppState.plotVisibility.gradient;
  plotFunction();
}

function toggleContour() {
  AppState.plotVisibility.contour = !AppState.plotVisibility.contour;
  plotFunction();
}

function toggleVectors() {
  AppState.plotVisibility.vectors = !AppState.plotVisibility.vectors;
  plotFunction();
}

// === EXPORT FUNCTIONALITY ===
function exportPlot() {
  try {
    const plot3d = document.getElementById('plot3d');
    const plot2d = document.getElementById('plot2d');
    
    // Export 3D plot
    Plotly.downloadImage('plot3d', {
      format: 'png',
      width: 800,
      height: 600,
      filename: `calculus_3d_${Date.now()}`
    });
    
    // Export 2D plot
    Plotly.downloadImage('plot2d', {
      format: 'png',
      width: 800,
      height: 600,
      filename: `calculus_2d_${Date.now()}`
    });
    
  } catch (error) {
    Utils.showError('Export failed: ' + error.message);
  }
}

// === RESET FUNCTION ===
function resetView() {
  // Reset sliders to default values
  document.getElementById('x0').value = 1;
  document.getElementById('y0').value = 2;
  updateLabels();
  
  // Reset plot visibility
  AppState.plotVisibility = {
    surface: true,
    tangentPlane: true,
    gradient: true,
    contour: true,
    vectors: true
  };
  
  // Re-plot
  plotFunction();
}

// === PRESET FUNCTIONS ===
function setupPresetHandlers() {
  const presetSelect = document.getElementById('presetSelect');
  if (presetSelect) {
    presetSelect.addEventListener('change', (e) => {
      if (e.target.value) {
        document.getElementById('func').value = e.target.value;
        plotFunction();
      }
    });
  }
}

// === MODAL FUNCTIONS ===
function showModal(content) {
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modalBody');
  
  modalBody.innerHTML = content;
  modal.style.display = 'flex';
  
  // Close modal handlers
  const closeBtn = modal.querySelector('.modal-close');
  closeBtn.onclick = () => modal.style.display = 'none';
  
  modal.onclick = (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
    }
  };
}

function showAbout() {
  const content = `
    <h2>About Advanced Calculus Visualizer</h2>
    <p>This interactive tool helps visualize multivariable calculus concepts including:</p>
    <ul>
      <li>3D surface plots</li>
      <li>Tangent planes</li>
      <li>Gradient fields</li>
      <li>Contour plots</li>
      <li>Partial derivatives</li>
    </ul>
    <p>Built with Plotly.js, Math.js, and modern web technologies.</p>
  `;
  showModal(content);
}

function showHelp() {
  const content = `
    <h2>How to Use</h2>
    <h3>Function Input</h3>
    <p>Enter mathematical expressions using standard notation:</p>
    <ul>
      <li><code>x^2 + y^2</code> - Paraboloid</li>
      <li><code>sin(x) + cos(y)</code> - Sine-cosine surface</li>
      <li><code>x*y</code> - Hyperbolic paraboloid</li>
      <li><code>exp(-(x^2 + y^2))</code> - Gaussian</li>
    </ul>
    
    <h3>Controls</h3>
    <ul>
      <li>Use sliders to adjust the point (x₀, y₀)</li>
      <li>Toggle plot elements on/off</li>
      <li>Export plots as PNG images</li>
      <li>Switch between light and dark themes</li>
    </ul>
  `;
  showModal(content);
}

function showKeyboardShortcuts() {
  const content = `
    <h2>Keyboard Shortcuts</h2>
    <ul>
      <li><kbd>Enter</kbd> - Generate plot</li>
      <li><kbd>Ctrl/Cmd + D</kbd> - Toggle dark mode</li>
      <li><kbd>Escape</kbd> - Close modal</li>
      <li><kbd>R</kbd> - Reset view</li>
    </ul>
  `;
  showModal(content);
}

// === KEYBOARD SHORTCUTS ===
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Enter to plot
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey) {
      e.preventDefault();
      plotFunction();
    }
    
    // Ctrl/Cmd + D for dark mode
    if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
      e.preventDefault();
      ThemeManager.toggleTheme();
    }
    
    // Escape to close modal
    if (e.key === 'Escape') {
      const modal = document.getElementById('modal');
      if (modal.style.display === 'flex') {
        modal.style.display = 'none';
      }
    }
    
    // R for reset
    if (e.key === 'r' && !e.ctrlKey && !e.metaKey) {
      resetView();
    }
  });
}

// === INITIALIZATION ===
function initializeApp() {
  // Setup theme
  ThemeManager.init();
  
  // Setup event listeners
  setupPresetHandlers();
  setupKeyboardShortcuts();
  
  // Debounced plot function for performance
  const debouncedPlot = Utils.debounce(plotFunction, 300);
  
  // Add input event listeners
  document.getElementById('func').addEventListener('input', debouncedPlot);
  document.getElementById('x0').addEventListener('input', () => {
    updateLabels();
    debouncedPlot();
  });
  document.getElementById('y0').addEventListener('input', () => {
    updateLabels();
    debouncedPlot();
  });
  
  // Initial plot
  plotFunction();
}

// === ERROR HANDLING ===
window.addEventListener('error', (e) => {
  console.error('Global error:', e.error);
  Utils.showError('An unexpected error occurred. Please try again.');
});

window.addEventListener('unhandledrejection', (e) => {
  console.error('Unhandled promise rejection:', e.reason);
  Utils.showError('An error occurred while processing your request.');
});

// === INITIALIZE ON LOAD ===
window.addEventListener('load', initializeApp);

// === LEGACY FUNCTIONS FOR BACKWARD COMPATIBILITY ===
// Keep the original function names for any existing references
window.updateLabels = updateLabels;
window.plotFunction = plotFunction;
window.toggleSurface = toggleSurface;
window.togglePlane = togglePlane;
window.toggleGradient = toggleGradient;
window.toggleContour = toggleContour;
window.toggleVectors = toggleVectors;
window.exportPlot = exportPlot;
window.resetView = resetView;
window.showAbout = showAbout;
window.showHelp = showHelp;
window.showKeyboardShortcuts = showKeyboardShortcuts;