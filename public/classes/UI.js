// handles the splitter UI with scrollable panels top and bottom
export class UI {
  dragging = false;
  startY = 0;
  startTopH = 0;
  startBottomH = 0;
  splitRatio = null; // null = use CSS flex defaults; 0–1 = top's share after drag

  constructor() {
    this.splitter = document.getElementById('splitter');
    this.panels = document.getElementById('panels');
    this.top = document.getElementById('top');
    this.bottom = document.getElementById('bottom');
    this.input = document.getElementById('input');
    this.minHeight = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--section-min-height')) * parseFloat(getComputedStyle(document.documentElement).fontSize);

    this.setupEvents();
    this.initDialog();
  }

  
  /**
   * initlialises the dialog, linking the element as a dialog
   */
  initDialog() {
    this.dialogElement = document.getElementById("dialog");
    this.dialogElement.addEventListener("close", () => {
      if (this.closeCallback) {
        this.closeCallback(this.dialogElement.returnValue);
      }
    });
  }

  /**
   * Adds the html content on the dialog and shows it
   * Attaches the callback to run when the dialog is closed
   * @param {string} html 
   * @param {function} closeCallback 
   */
  showDialog(html, closeCallback = () => { }) {
    this.closeCallback = closeCallback;
    this.dialogElement.addEventListener("close", this.closeCallback);
    this.dialogElement.innerHTML = html;
    this.dialogElement.showModal();
  }

  /**
   * Closes the dialog
   */
  closeDialog() {
    this.dialogElement.close();
  }


  /** Redistribute top/bottom within #panels based on the stored ratio */
  applySplitRatio() {
    if (this.splitRatio === null) return; // CSS flex handles it before any drag
    const available = this.panels.getBoundingClientRect().height - this.panels.getBoundingClientRect().height;

    let topH = available * this.splitRatio;
    let bottomH = available * (1 - this.splitRatio);

    // enforce minimums
    if (topH < this.minHeight) { topH = this.minHeight; bottomH = available - this.minHeight; }
    if (bottomH < this.minHeight) { bottomH = this.minHeight; topH = available - this.minHeight; }

    this.top.style.flex = `0 0 ${topH}px`;
    this.bottom.style.flex = `0 0 ${bottomH}px`;
  };

  /**
   * Attach event listners to things that need them
   */
  setupEvents() {
    this.panels.addEventListener('pointerdown', (e) => {
      this.dragging = true;
      this.startY = e.clientY;
      this.startTopH = this.top.getBoundingClientRect().height;
      this.startBottomH = this.bottom.getBoundingClientRect().height;
      this.panels.setPointerCapture(e.pointerId);
      e.preventDefault();
    });

    this.panels.addEventListener('pointermove', (e) => {
      if (!this.dragging) return;
      const dy = e.clientY - this.startY;
      let newTopH = this.startTopH + dy;
      let newBottomH = this.startBottomH - dy;

      // enforce minimums
      if (newTopH < this.minHeight) {
        newTopH = this.minHeight;
        newBottomH = this.startTopH + this.startBottomH - this.minHeight;
      }
      if (newBottomH < this.minHeight) {
        newBottomH = this.minHeight;
        newTopH = this.startTopH + this.startBottomH - this.minHeight;
      }
      newBottomH -= this.input.getBoundingClientRect().height * 1.3;

      this.top.style.flex = `0 0 ${newTopH}px`;
      this.bottom.style.flex = `0 0 ${newBottomH}px`;
    });

    this.panels.addEventListener('pointerup', (e) => {
      this.dragging = false;
      this.panels.releasePointerCapture(e.pointerId);
      // store ratio so resizes stay proportional
      const topH = this.top.getBoundingClientRect().height;
      const bottomH = this.bottom.getBoundingClientRect().height;
      this.splitRatio = topH / (topH + bottomH);
    });

    this.panels.addEventListener('pointercancel', (e) => {
      this.dragging = false;
    });

    // ── Proportional resize when viewport changes (keyboard, window resize) ──
    new ResizeObserver(() => {
      if (!this.dragging) this.applySplitRatio();
    }).observe(this.panels);
  }
};
