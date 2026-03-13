if (!customElements.get('product-card')) {
  class ComponentProductCard extends HTMLElement {
    constructor() {
      super()
      this.quickViewBtn = this.querySelector('.quick-view-trigger')
      this.swatches = this.querySelector('.inline-swatch-group')
      if(this.quickViewBtn)
        this.quickViewBtn.addEventListener('click', this.openQuickView.bind(this))
      if(this.swatches)
        this.swatches.querySelectorAll('input').forEach((input)=>{
          input.addEventListener('change', this.onSwatchChange.bind(this))
        })

      let imageContainer = this.querySelector('.image-container');
      if (imageContainer && imageContainer.querySelector('.hover-img')) {
        let hover = false;
        this.addEventListener('mouseleave', (e)=>{
          hover && (hover=false,imageContainer.classList.remove("hover"));
        });
        this.addEventListener('mousemove', (e)=>{
          let bounds = imageContainer.getBoundingClientRect();
          if (e.y>bounds.top && e.y<bounds.bottom && e.x>bounds.left && e.x<bounds.right) {
            hover || (hover=true,imageContainer.classList.add("hover"))
          } else {
            hover && (hover=false,imageContainer.classList.remove("hover"));
          }
        });
      }
    }

    openQuickView(e) {
      e.preventDefault()
      $s.showLoadingOverlay();
      var qvUrl = this.quickViewBtn.dataset.url;
      $s.get({
        url: qvUrl,
        success: (html)=>{
          var parser = new DOMParser();
          var doc = parser.parseFromString(html, "text/html");
          var section = doc.querySelector('.product-main-element').closest('.shopify-section');
          $s.openModal(section, 'product-quick-view');
          $s.globalEval(section);
        },
        always: (html)=>{
          $s.hideLoadingOverlay();
        }
      })
    }

    onSwatchChange() {
      var checkedOption = this.querySelector('.inline-swatch-group input:checked')
      var variantImg = checkedOption.dataset.variantImg
      var variantUrl = checkedOption.dataset.variantUrl
      var priceFinal = checkedOption.dataset.priceFinal
      var priceCompare = checkedOption.dataset.priceCompare

      this.querySelectorAll('.product-card-url').forEach(function(e){
        e.setAttribute('href', variantUrl)
      });
      if (this.quickViewBtn)
        this.quickViewBtn.setAttribute('data-url', variantUrl)
      this.querySelector('.final').innerHTML = priceFinal
      if(this.querySelector('.from')) {
        this.querySelector('.from').style.display = "none"
      }
      if(priceCompare) {
        this.querySelector('.compare').innerHTML = priceCompare
        this.querySelector('.compare').style.display = "block"
      } else {
        this.querySelector('.compare').style.display = "none"
      }
      if(variantImg) {
        this.querySelector('.img.main').setAttribute('srcset', variantImg)
      }
    }
  }
  customElements.define('product-card', ComponentProductCard);
}