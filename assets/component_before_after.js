if(!customElements.get('before-after')) {
  class BeforeAfter extends HTMLElement {
    constructor() {
      super();
      var section = this;
      var slider = section.querySelector('.slider');
      var separator = section.querySelector('.custom-separator');
      var img2 = section.querySelector('.img2');
      function updateSeparator() {
        var left = 100 * slider.value / (slider.max - slider.min);
        separator.style.left = left + '%';
        img2.style.width = (100 - left) + '%';
      }
      slider.addEventListener('input', updateSeparator);
      slider.addEventListener('mouseup', function() {
        this.blur();
      });
      var animTID = 0;
      var animDuration = 400;
      slider.addEventListener('keydown', function(evt) {
        if (evt.keyCode == 37 || evt.keyCode == 40) {
          slider.value = slider.min;
        }
        if (evt.keyCode == 38 || evt.keyCode == 39) {
          slider.value = slider.max;
        }
        clearTimeout(animTID);
        separator.style.transition = 'all '+animDuration+'ms ease-out';
        img2.style.transition = 'all '+animDuration+'ms ease-out';
        updateSeparator();
        animTID = setTimeout(()=> {
          separator.style.transition = '';
          img2.style.transition = '';
        }, animDuration)
      })
      updateSeparator();
      section.classList.add('initialized');
    }
  }
  customElements.define('before-after', BeforeAfter);
}