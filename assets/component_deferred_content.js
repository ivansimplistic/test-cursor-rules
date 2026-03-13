if(!customElements.get('deferred-content')) {
  class DeferredContent extends HTMLElement {
    constructor() {
      super();
      let mode = this.dataset.mode || 'load';
      if (mode == 'scroll') {
        const offset = this.dataset.offset || '50%';
        const observer = new IntersectionObserver((entries, observer) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              observer.disconnect();
              this.loadContent();
            }
          });
        }, {
          root: null, // viewport
          rootMargin: `${offset} 0px ${offset} 0px`, // top, right, bottom, left
          threshold: 0 // trigger as soon as any part is visible within margin
        });
        
        observer.observe(this);
      } else if (mode == 'load' && document.readyState != 'complete') {
        window.addEventListener('load', this.loadContent.bind(this));
      } else {
        this.loadContent();
      }
    }
  
    loadContent() {
      this.insertAdjacentElement('afterend', this.querySelector('template').content.firstElementChild);
      this.parentNode.removeChild(this);
    }
  }
  
  customElements.define('deferred-content', DeferredContent);}
