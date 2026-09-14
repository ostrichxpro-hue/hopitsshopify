/* =============================================================================
   Hopits theme scripts
   Vanilla JS, no dependencies. Everything is progressive: the storefront works
   with JS disabled (forms post normally, links navigate), and these behaviours
   layer speed on top.
   ========================================================================== */
(function () {
  'use strict';

  var Hopits = window.Hopits || {};
  var routes = Hopits.routes || {};
  var strings = Hopits.strings || {};

  /* --- Utilities --------------------------------------------------------- */

  function on(el, evt, handler, opts) {
    if (el) el.addEventListener(evt, handler, opts);
  }

  function $(sel, scope) {
    return (scope || document).querySelector(sel);
  }

  function $$(sel, scope) {
    return Array.prototype.slice.call((scope || document).querySelectorAll(sel));
  }

  function debounce(fn, wait) {
    var t;
    return function () {
      var args = arguments;
      var ctx = this;
      clearTimeout(t);
      t = setTimeout(function () {
        fn.apply(ctx, args);
      }, wait);
    };
  }

  /**
   * Formats cents into the shop's money format.
   * Supports the amount, amount_no_decimals, amount_with_comma_separator and
   * amount_no_decimals_with_comma_separator placeholders.
   */
  function formatMoney(cents, format) {
    if (typeof cents === 'string') cents = cents.replace('.', '');
    var fmt = format || Hopits.moneyFormat || '{{amount}}';
    var placeholder = /\{\{\s*(\w+)\s*\}\}/;

    function thousands(num, precision, thousandSep, decimalSep) {
      thousandSep = thousandSep == null ? ',' : thousandSep;
      decimalSep = decimalSep == null ? '.' : decimalSep;
      if (isNaN(num) || num == null) return '0';
      var value = (num / 100.0).toFixed(precision);
      var parts = value.split('.');
      var whole = parts[0].replace(/(\d)(?=(\d\d\d)+(?!\d))/g, '$1' + thousandSep);
      var dec = parts[1] ? decimalSep + parts[1] : '';
      return whole + dec;
    }

    var value = '';
    var match = fmt.match(placeholder);
    switch (match && match[1]) {
      case 'amount':
        value = thousands(cents, 2);
        break;
      case 'amount_no_decimals':
        value = thousands(cents, 0);
        break;
      case 'amount_with_comma_separator':
        value = thousands(cents, 2, '.', ',');
        break;
      case 'amount_no_decimals_with_comma_separator':
        value = thousands(cents, 0, '.', ',');
        break;
      default:
        value = thousands(cents, 2);
    }
    return fmt.replace(placeholder, value);
  }

  function toast(message, isError) {
    var region = document.getElementById('ToastRegion');
    if (!region) return;
    var el = document.createElement('div');
    el.className = 'toast' + (isError ? ' toast--error' : '');
    el.textContent = message;
    region.appendChild(el);
    setTimeout(function () {
      el.style.transition = 'opacity .3s ease';
      el.style.opacity = '0';
      setTimeout(function () {
        el.remove();
      }, 320);
    }, 2600);
  }

  /* --- Focus trapping ----------------------------------------------------- */

  var FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  var trapState = { el: null, previous: null, handler: null };

  function trapFocus(container) {
    releaseFocus();
    trapState.previous = document.activeElement;
    trapState.el = container;

    var first = $(FOCUSABLE, container);
    if (first) first.focus();

    trapState.handler = function (e) {
      if (e.key !== 'Tab') return;
      var items = $$(FOCUSABLE, container).filter(function (el) {
        return el.offsetParent !== null;
      });
      if (!items.length) return;
      var firstEl = items[0];
      var lastEl = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    document.addEventListener('keydown', trapState.handler);
  }

  function releaseFocus() {
    if (trapState.handler) document.removeEventListener('keydown', trapState.handler);
    if (trapState.previous && typeof trapState.previous.focus === 'function') {
      trapState.previous.focus();
    }
    trapState = { el: null, previous: null, handler: null };
  }

  /* --- Overlay panels (drawers, modals) ----------------------------------- */

  var openPanels = [];

  function ensureOverlay() {
    var overlay = $('#Overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'Overlay';
      overlay.className = 'overlay';
      document.body.appendChild(overlay);
      on(overlay, 'click', function () {
        closePanel();
      });
    }
    return overlay;
  }

  function openPanel(el) {
    if (!el) return;
    ensureOverlay().classList.add('is-open');
    el.classList.add('is-open');
    el.removeAttribute('hidden');
    el.setAttribute('aria-hidden', 'false');
    document.body.classList.add('no-scroll');
    openPanels.push(el);
    trapFocus(el);
  }

  function closePanel(el) {
    var target = el || openPanels[openPanels.length - 1];
    if (!target) return;
    target.classList.remove('is-open');
    target.setAttribute('aria-hidden', 'true');
    openPanels = openPanels.filter(function (p) {
      return p !== target;
    });
    if (!openPanels.length) {
      var overlay = $('#Overlay');
      if (overlay) overlay.classList.remove('is-open');
      document.body.classList.remove('no-scroll');
    }
    releaseFocus();
  }

  window.HopitsPanels = { open: openPanel, close: closePanel };

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && openPanels.length) closePanel();
  });

  document.addEventListener('click', function (e) {
    var opener = e.target.closest('[data-panel-open]');
    if (opener) {
      e.preventDefault();
      openPanel($('#' + opener.getAttribute('data-panel-open')));
      return;
    }
    var closer = e.target.closest('[data-panel-close]');
    if (closer) {
      e.preventDefault();
      var id = closer.getAttribute('data-panel-close');
      closePanel(id ? $('#' + id) : null);
    }
  });

  /* --- Cart --------------------------------------------------------------- */

  var Cart = {
    /**
     * Sections we ask Shopify to re-render on every cart mutation.
     * The Section Rendering API keys off section IDs, which differ between the
     * layout-rendered drawer and the cart template, so read them off the DOM.
     */
    sectionsToRender: function () {
      return $$('[data-cart-root]')
        .map(function (el) {
          return el.getAttribute('data-section-id');
        })
        .filter(Boolean);
    },

    add: function (items, opts) {
      opts = opts || {};
      var body = {
        items: items,
        sections: this.sectionsToRender().join(','),
        sections_url: window.location.pathname
      };
      return fetch(routes.cartAdd, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body)
      })
        .then(function (res) {
          return res.json().then(function (data) {
            if (!res.ok) throw data;
            return data;
          });
        })
        .then(
          function (data) {
            Cart.renderSections(data.sections);
            Cart.refreshCount();
            if (Hopits.cartType === 'drawer' && !opts.silent) {
              openPanel($('#CartDrawer'));
            } else if (!opts.silent) {
              toast(strings.added || 'Added');
            }
            document.dispatchEvent(new CustomEvent('hopits:cart:updated', { detail: data }));
            return data;
          },
          function (err) {
            toast((err && err.description) || strings.cartError || 'Error', true);
            throw err;
          }
        );
    },

    change: function (payload) {
      payload.sections = this.sectionsToRender().join(',');
      payload.sections_url = window.location.pathname;
      return fetch(routes.cartChange, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload)
      })
        .then(function (res) {
          return res.json();
        })
        .then(function (data) {
          Cart.renderSections(data.sections);
          Cart.refreshCount(data.item_count);
          document.dispatchEvent(new CustomEvent('hopits:cart:updated', { detail: data }));
          return data;
        })
        .catch(function () {
          toast(strings.cartError || 'Error', true);
        });
    },

    /**
     * Swaps in freshly rendered section markup. Shopify returns a full section
     * wrapper, so we pull out the inner container by its data attribute.
     */
    renderSections: function (sections) {
      if (!sections) return;
      Object.keys(sections).forEach(function (id) {
        var parsed = new DOMParser().parseFromString(sections[id], 'text/html');
        var incoming = parsed.querySelector('[data-cart-root]');
        var current = $('[data-cart-root][data-section-id="' + id + '"]');
        if (incoming && current) {
          current.innerHTML = incoming.innerHTML;
          paintFreeShipping();
        }
      });
    },

    refreshCount: function (count) {
      function paint(n) {
        $$('[data-cart-count]').forEach(function (el) {
          el.textContent = n;
          el.hidden = n === 0;
        });
      }
      if (typeof count === 'number') return paint(count);
      fetch(routes.cart + '.js')
        .then(function (r) {
          return r.json();
        })
        .then(function (cart) {
          paint(cart.item_count);
        })
        .catch(function () {});
    }
  };

  window.HopitsCart = Cart;

  /* --- Add to cart forms --------------------------------------------------- */

  document.addEventListener('submit', function (e) {
    var form = e.target.closest('form[data-cart-form]');
    if (!form) return;
    e.preventDefault();

    var button = form.querySelector('[type="submit"]');
    var idInput = form.querySelector('[name="id"]');
    if (!idInput || !idInput.value) {
      toast(strings.selectSize || 'Please choose an option', true);
      return;
    }

    var qtyInput = form.querySelector('[name="quantity"]');
    var item = { id: Number(idInput.value), quantity: Number(qtyInput ? qtyInput.value : 1) || 1 };

    var properties = {};
    $$('[name^="properties["]', form).forEach(function (input) {
      var key = input.name.replace('properties[', '').replace(']', '');
      if (input.value) properties[key] = input.value;
    });
    if (Object.keys(properties).length) item.properties = properties;

    var originalLabel = button ? button.textContent : '';
    if (button) {
      button.setAttribute('aria-disabled', 'true');
      button.textContent = strings.adding || 'Adding…';
    }

    Cart.add([item]).finally(function () {
      if (button) {
        button.removeAttribute('aria-disabled');
        button.textContent = originalLabel;
      }
    });
  });

  /* Cart quantity + remove controls (delegated so re-rendered markup works) */
  document.addEventListener('click', function (e) {
    var step = e.target.closest('[data-quantity-step]');
    if (step) {
      var wrap = step.closest('.quantity');
      var input = wrap && wrap.querySelector('input');
      if (!input) return;
      var delta = step.getAttribute('data-quantity-step') === 'up' ? 1 : -1;
      var min = Number(input.min || 1);
      var next = Math.max(min, (Number(input.value) || min) + delta);
      input.value = next;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }

    var remove = e.target.closest('[data-cart-remove]');
    if (remove) {
      e.preventDefault();
      Cart.change({ line: Number(remove.getAttribute('data-cart-remove')), quantity: 0 });
    }
  });

  document.addEventListener(
    'change',
    debounce(function (e) {
      var input = e.target.closest('[data-cart-quantity]');
      if (!input) return;
      Cart.change({ line: Number(input.getAttribute('data-cart-quantity')), quantity: Number(input.value) });
    }, 300)
  );

  document.addEventListener(
    'change',
    debounce(function (e) {
      var note = e.target.closest('[data-cart-note]');
      if (!note) return;
      fetch(routes.cartUpdate, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: note.value })
      });
    }, 500)
  );

  /* --- Free shipping progress --------------------------------------------- */

  function paintFreeShipping(cart) {
    var bars = $$('[data-free-shipping]');
    if (!bars.length || !Hopits.freeShipping || !Hopits.freeShipping.enabled) return;
    var threshold = Hopits.freeShipping.threshold;
    var total = cart ? cart.total_price : Number(bars[0].getAttribute('data-cart-total') || 0);
    var remaining = Math.max(0, threshold - total);
    var pct = threshold > 0 ? Math.min(100, (total / threshold) * 100) : 100;

    bars.forEach(function (bar) {
      var fill = bar.querySelector('[data-free-shipping-fill]');
      var label = bar.querySelector('[data-free-shipping-label]');
      if (fill) fill.style.width = pct + '%';
      if (label) {
        if (remaining <= 0) {
          label.textContent = bar.getAttribute('data-unlocked-text') || '';
          bar.classList.add('free-shipping--unlocked');
        } else {
          var tpl = bar.getAttribute('data-progress-text') || '';
          label.textContent = tpl.replace('[amount]', formatMoney(remaining));
          bar.classList.remove('free-shipping--unlocked');
        }
      }
    });
  }

  document.addEventListener('hopits:cart:updated', function (e) {
    paintFreeShipping(e.detail);
  });

  /* --- Variant picker ------------------------------------------------------ */

  function VariantPicker(root) {
    var dataEl = root.querySelector('[data-variant-json]');
    if (!dataEl) return;

    var variants;
    try {
      variants = JSON.parse(dataEl.textContent);
    } catch (err) {
      return;
    }

    var form = root.querySelector('form[data-cart-form]');
    var idInput = form && form.querySelector('[name="id"]');
    var priceTarget = root.querySelector('[data-price-target]');
    var stockTarget = root.querySelector('[data-stock-target]');
    var skuTarget = root.querySelector('[data-sku-target]');
    var submit = form && form.querySelector('[type="submit"]');

    function selectedOptions() {
      return $$('[data-option-input]:checked', root).map(function (input) {
        return input.value;
      });
    }

    function findVariant(opts) {
      return variants.find(function (v) {
        return v.options.every(function (opt, i) {
          return opt === opts[i];
        });
      });
    }

    /** Greys out option values that cannot combine with the current selection. */
    function markAvailability(opts) {
      $$('[data-option-input]', root).forEach(function (input) {
        var index = Number(input.getAttribute('data-option-index'));
        var candidate = opts.slice();
        candidate[index] = input.value;
        var match = variants.find(function (v) {
          return v.options.every(function (opt, i) {
            return i === index ? opt === input.value : opt === candidate[i] || candidate[i] == null;
          });
        });
        var label = root.querySelector('label[for="' + input.id + '"]');
        if (!label) return;
        label.classList.toggle('variant-option--unavailable', !match || !match.available);
      });
    }

    function update() {
      var opts = selectedOptions();
      var variant = findVariant(opts);
      markAvailability(opts);

      if (!variant) {
        if (idInput) idInput.value = '';
        if (submit) {
          submit.setAttribute('aria-disabled', 'true');
          submit.textContent = strings.unavailable || 'Unavailable';
        }
        return;
      }

      if (idInput) idInput.value = variant.id;

      // Keep the URL shareable without a reload.
      if (window.history.replaceState) {
        var url = new URL(window.location.href);
        url.searchParams.set('variant', variant.id);
        window.history.replaceState({}, '', url.toString());
      }

      if (priceTarget && variant.price_html) priceTarget.innerHTML = variant.price_html;
      if (skuTarget) skuTarget.textContent = variant.sku || '';

      if (stockTarget) {
        stockTarget.className = 'stock-line' + (variant.available ? (variant.low ? ' stock-line--low' : '') : ' stock-line--out');
        var text = variant.available
          ? variant.low
            ? stockTarget.getAttribute('data-low-text').replace('[count]', variant.inventory)
            : stockTarget.getAttribute('data-in-text')
          : stockTarget.getAttribute('data-out-text');
        var textEl = stockTarget.querySelector('[data-stock-text]');
        if (textEl) textEl.textContent = text;
      }

      if (submit) {
        if (variant.available) {
          submit.removeAttribute('aria-disabled');
          submit.textContent = strings.addToCart || 'Add to cart';
        } else {
          submit.setAttribute('aria-disabled', 'true');
          submit.textContent = strings.soldOut || 'Sold out';
        }
      }

      // Jump the gallery to the variant's image.
      if (variant.media_id) {
        var thumb = root.querySelector('[data-media-id="' + variant.media_id + '"]');
        if (thumb) thumb.click();
      }

      document.dispatchEvent(new CustomEvent('hopits:variant:changed', { detail: variant }));
    }

    $$('[data-option-input]', root).forEach(function (input) {
      on(input, 'change', update);
    });

    update();
  }

  /* --- Product gallery ----------------------------------------------------- */

  function Gallery(root) {
    var slides = $$('[data-gallery-slide]', root);
    var thumbs = $$('[data-gallery-thumb]', root);

    function show(index) {
      slides.forEach(function (slide, i) {
        slide.classList.toggle('is-active', i === index);
      });
      thumbs.forEach(function (thumb, i) {
        thumb.setAttribute('aria-current', i === index ? 'true' : 'false');
      });
    }

    thumbs.forEach(function (thumb, i) {
      on(thumb, 'click', function () {
        show(i);
      });
    });
  }

  /* --- Quick add from a product card --------------------------------------- */

  document.addEventListener('click', function (e) {
    var sizeBtn = e.target.closest('.card-sizes__btn');
    if (sizeBtn && !sizeBtn.disabled) {
      e.preventDefault();
      var group = sizeBtn.closest('.card-sizes');
      $$('.card-sizes__btn', group).forEach(function (b) {
        b.setAttribute('aria-pressed', b === sizeBtn ? 'true' : 'false');
      });
      var card = sizeBtn.closest('[data-product-card]');
      var hidden = card && card.querySelector('[data-quick-add-variant]');
      if (hidden) hidden.value = sizeBtn.getAttribute('data-variant-id');
      return;
    }

    var quickAdd = e.target.closest('[data-quick-add]');
    if (!quickAdd) return;
    e.preventDefault();

    var cardRoot = quickAdd.closest('[data-product-card]');
    var variantInput = cardRoot && cardRoot.querySelector('[data-quick-add-variant]');
    var variantId = variantInput && variantInput.value;

    if (!variantId) {
      // No size chosen yet — nudge rather than guessing one for the shopper.
      var sizes = cardRoot && cardRoot.querySelector('.card-sizes');
      if (sizes) {
        sizes.animate(
          [{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }],
          { duration: 320 }
        );
      }
      toast(strings.selectSize || 'Please pick a size', true);
      return;
    }

    var original = quickAdd.textContent;
    quickAdd.setAttribute('aria-disabled', 'true');
    quickAdd.textContent = strings.adding || 'Adding…';

    Cart.add([{ id: Number(variantId), quantity: 1 }]).finally(function () {
      quickAdd.removeAttribute('aria-disabled');
      quickAdd.textContent = original;
    });
  });

  /* --- Accordions ---------------------------------------------------------- */

  document.addEventListener('click', function (e) {
    var trigger = e.target.closest('[data-accordion-trigger]');
    if (!trigger) return;
    var expanded = trigger.getAttribute('aria-expanded') === 'true';
    var panel = document.getElementById(trigger.getAttribute('aria-controls'));
    trigger.setAttribute('aria-expanded', expanded ? 'false' : 'true');
    if (panel) panel.hidden = expanded;
  });

  /* --- Mobile nav sub-menus ------------------------------------------------ */

  document.addEventListener('click', function (e) {
    var toggle = e.target.closest('[data-mobile-submenu]');
    if (!toggle) return;
    e.preventDefault();
    var expanded = toggle.getAttribute('aria-expanded') === 'true';
    var list = document.getElementById(toggle.getAttribute('aria-controls'));
    toggle.setAttribute('aria-expanded', expanded ? 'false' : 'true');
    if (list) list.classList.toggle('is-open', !expanded);
  });

  /* --- Predictive search --------------------------------------------------- */

  function PredictiveSearch(root) {
    var input = root.querySelector('[data-search-input]');
    var results = root.querySelector('[data-search-results]');
    if (!input || !results || !routes.predictiveSearch) return;

    var controller;

    var run = debounce(function () {
      var term = input.value.trim();
      if (term.length < 2) {
        results.innerHTML = '';
        return;
      }
      if (controller) controller.abort();
      controller = new AbortController();

      var url =
        routes.predictiveSearch +
        '?q=' +
        encodeURIComponent(term) +
        '&resources[type]=product,collection,page&resources[limit]=6&section_id=predictive-search';

      fetch(url, { signal: controller.signal })
        .then(function (res) {
          return res.text();
        })
        .then(function (html) {
          var parsed = new DOMParser().parseFromString(html, 'text/html');
          var inner = parsed.querySelector('[data-predictive-root]');
          results.innerHTML = inner ? inner.innerHTML : '';
        })
        .catch(function () {});
    }, 250);

    on(input, 'input', run);
  }

  /* --- Announcement rotator ------------------------------------------------ */

  function Announcement(root) {
    var items = $$('.announcement__item', root);
    if (items.length < 2) return;
    var interval = Number(root.getAttribute('data-interval') || 5) * 1000;
    var index = 0;
    setInterval(function () {
      items[index].classList.remove('is-active');
      index = (index + 1) % items.length;
      items[index].classList.add('is-active');
    }, interval);
  }

  /* --- Slideshow ----------------------------------------------------------- */

  function Slideshow(root) {
    var slides = $$('[data-slide]', root);
    if (slides.length < 2) return;
    var dots = $$('[data-slide-dot]', root);
    var autoplay = root.getAttribute('data-autoplay') === 'true';
    var speed = Number(root.getAttribute('data-speed') || 6) * 1000;
    var index = 0;
    var timer;

    function show(i) {
      index = (i + slides.length) % slides.length;
      slides.forEach(function (s, n) {
        s.classList.toggle('is-active', n === index);
      });
      dots.forEach(function (d, n) {
        d.setAttribute('aria-current', n === index ? 'true' : 'false');
      });
    }

    function start() {
      if (!autoplay) return;
      stop();
      timer = setInterval(function () {
        show(index + 1);
      }, speed);
    }
    function stop() {
      if (timer) clearInterval(timer);
    }

    dots.forEach(function (dot, n) {
      on(dot, 'click', function () {
        show(n);
        start();
      });
    });

    on(root, 'mouseenter', stop);
    on(root, 'mouseleave', start);
    show(0);
    start();
  }

  /* --- Kids size finder ---------------------------------------------------- */

  function SizeFinder(root) {
    var input = root.querySelector('[data-size-input]');
    var button = root.querySelector('[data-size-submit]');
    var output = root.querySelector('[data-size-result]');
    if (!input || !button || !output) return;

    var rows;
    try {
      rows = JSON.parse(root.getAttribute('data-size-rows') || '[]');
    } catch (err) {
      rows = [];
    }
    if (!rows.length) return;

    function run() {
      var cm = parseFloat(input.value);
      output.hidden = false;
      output.classList.remove('size-finder__result--error');

      if (isNaN(cm) || cm < 10 || cm > 26) {
        output.classList.add('size-finder__result--error');
        output.textContent = root.getAttribute('data-invalid-text') || '';
        return;
      }

      // Add half a centimetre of growing room, then take the first size that fits.
      var target = cm + 0.5;
      var match = rows.find(function (row) {
        return parseFloat(row.length) >= target;
      });

      $$('.size-table tbody tr', document).forEach(function (tr) {
        tr.classList.remove('is-match');
      });

      if (!match) {
        output.classList.add('size-finder__result--error');
        output.textContent = root.getAttribute('data-out-of-range-text') || '';
        return;
      }

      output.innerHTML =
        '<strong>' +
        (root.getAttribute('data-result-text') || 'Size [size]').replace('[size]', match.size) +
        '</strong><small>' +
        (root.getAttribute('data-grown-text') || '') +
        '</small>';

      var matchRow = $('.size-table tbody tr[data-size="' + match.size + '"]');
      if (matchRow) {
        matchRow.classList.add('is-match');
        matchRow.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }

    on(button, 'click', run);
    on(input, 'keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        run();
      }
    });
  }

  /* --- Product recommendations --------------------------------------------- */

  function Recommendations(root) {
    var url = root.getAttribute('data-url');
    if (!url) return;
    fetch(url)
      .then(function (res) {
        return res.text();
      })
      .then(function (html) {
        var parsed = new DOMParser().parseFromString(html, 'text/html');
        var incoming = parsed.querySelector('[data-recommendations]');
        // Only swap when Shopify actually returned products, so the
        // server-rendered fallback stays put on a cold cache.
        if (incoming && incoming.querySelector('.product-card')) {
          root.innerHTML = incoming.innerHTML;
          init(root);
        }
      })
      .catch(function () {});
  }

  /* --- Share --------------------------------------------------------------- */

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-share]');
    if (!btn) return;
    e.preventDefault();
    var url = btn.getAttribute('data-share') || window.location.href;
    if (navigator.share) {
      navigator.share({ title: document.title, url: url }).catch(function () {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(function () {
        toast(strings.copied || 'Link copied');
      });
    }
  });

  /* --- Facets: submit filter forms without a full reload ------------------- */

  function Facets(root) {
    var form = root.querySelector('[data-facet-form]');
    if (!form) return;

    function apply(url) {
      fetch(url)
        .then(function (res) {
          return res.text();
        })
        .then(function (html) {
          var parsed = new DOMParser().parseFromString(html, 'text/html');
          ['[data-facet-panel]', '[data-product-results]', '[data-active-filters]', '[data-facet-count]'].forEach(function (sel) {
            var incoming = parsed.querySelector(sel);
            var current = $(sel);
            if (incoming && current) current.innerHTML = incoming.innerHTML;
          });
          window.history.pushState({ url: url }, '', url);
          var grid = $('[data-product-results]');
          if (grid) grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
        })
        .catch(function () {
          window.location.href = url;
        });
    }

    on(form, 'change', function () {
      var params = new URLSearchParams(new FormData(form));
      apply(window.location.pathname + '?' + params.toString());
    });

    document.addEventListener('click', function (e) {
      var link = e.target.closest('[data-facet-link]');
      if (!link) return;
      e.preventDefault();
      apply(link.href);
    });

    on(window, 'popstate', function () {
      window.location.reload();
    });
  }

  /* --- Sticky header shadow on scroll -------------------------------------- */

  function stickyHeader() {
    var header = $('.header');
    if (!header) return;
    var last = 0;
    on(
      window,
      'scroll',
      function () {
        var y = window.scrollY;
        header.classList.toggle('is-stuck', y > 8);
        last = y;
      },
      { passive: true }
    );
  }

  /* --- Boot ---------------------------------------------------------------- */

  function init(scope) {
    scope = scope || document;
    $$('[data-variant-picker]', scope).forEach(VariantPicker);
    $$('[data-gallery]', scope).forEach(Gallery);
    $$('[data-predictive-search]', scope).forEach(PredictiveSearch);
    $$('[data-announcement]', scope).forEach(Announcement);
    $$('[data-slideshow]', scope).forEach(Slideshow);
    $$('[data-size-finder]', scope).forEach(SizeFinder);
    $$('[data-facets]', scope).forEach(Facets);
    $$('[data-recommendations]', scope).forEach(Recommendations);
    paintFreeShipping();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      init();
      stickyHeader();
    });
  } else {
    init();
    stickyHeader();
  }

  // Re-initialise when the theme editor swaps a section.
  document.addEventListener('shopify:section:load', function (e) {
    init(e.target);
  });

  window.HopitsInit = init;
  window.HopitsFormatMoney = formatMoney;
})();
