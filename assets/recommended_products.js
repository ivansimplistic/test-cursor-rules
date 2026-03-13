if(!customElements.get('recommended-products')) {
  class RecommendedProducts extends HTMLElement {
    constructor() {
      super();
      if (this.dataset.load!='manual') {
        this.loadRecommendations();
      }
    }
    
    async loadRecommendations() {
      const productIds = this.dataset.productIds;
      const limit = this.dataset.limit;
      const templateContent = this.querySelector('template').content.cloneNode(true);
      const templateRootElement = templateContent.querySelector('.products-carousel-root');
      const itemsContent = templateRootElement.querySelector('.keen-slider, .grid');
      const intent = this.dataset.intent;

      let queries = [];
      const ids = productIds && productIds.replaceAll(' ','').split(',') || [];
      for (let i = 0; i < ids.length; i++) {
        queries.splice(i, 0, {id: ids[i], intent: (intent=='related' ? 'related' : 'complementary')});
        if (i==0 && intent == 'mixed') {
          queries.push({id: ids[i], intent: 'related'});
        }
      }
      queries.forEach(x=>{x.url = routes.product_recommendations_url + `?product_id=${x.id}&limit=${limit}&section_id=recommended_products_view&intent=${x.intent}` })
      var urls = queries.map(x=>{ return x.url});

      const data = urls.length > 0 ? await $s.getDataFromUrls(urls) : {};

      var cardsHtml = [];
      var parser = new DOMParser();
      var productsLoaded = {};
      var shown = 0;

      queries.forEach(x=>{
        var url = x.url;
        var text = data[url];
        if(text && text.indexOf('data-recommendation-type')>-1) {
          var html = itemsContent.classList.contains('grid') ? text.replaceAll('keen-slider-slide', 'grid-item') : text;
          html = html.replaceAll('recommended_products_view', this.closest('.shopify-section').id);
          var doc = parser.parseFromString(html, 'text/html');
          doc.querySelectorAll('.product-card').forEach(card=>{
            if(shown < limit && !productsLoaded[card.dataset.productId]) {
              shown++;
              productsLoaded[card.dataset.productId] = 1;
              cardsHtml.push(card.parentNode.outerHTML);
            }
          });
          
        }
      });
      if (this.dataset.shuffle) {
        const shuffle = (array) => { 
          for (let i = array.length - 1; i > 0; i--) { 
            const j = Math.floor(Math.random() * (i + 1)); 
            [array[i], array[j]] = [array[j], array[i]]; 
          } 
          return array; 
        };
        cardsHtml = shuffle(cardsHtml);
      }

      itemsContent.innerHTML = cardsHtml.join('');
      itemsContent.querySelectorAll('.product-card').forEach(card => {
        if (this.dataset.cardsColorScheme) {
          card.classList.add('scheme', ...this.dataset.cardsColorScheme.split(' '));
        }
        if (this.dataset.cardsColorScheme==this.dataset.contentColorScheme) {
          card.classList.add('same-scheme-true');
          card.classList.remove('same-scheme-false');
        } else {
          card.classList.add('same-scheme-false');
          card.classList.remove('same-scheme-true');
        }
      });
      this.querySelector('.products-carousel-root')?.remove();
      this.insertAdjacentElement('beforeend', templateRootElement);
      if (shown>0) {
        this.style.display = ''; //removes 'display: none'
        $s.dispatchEvent(this, 'recommendations:show');
      } else {
        this.style.display = 'none'; 
        $s.dispatchEvent(this, 'recommendations:hide');
      }

    }
  }
  customElements.define('recommended-products', RecommendedProducts);
}