/**
 * keen-slider 5.5.1
 * The HTML touch slider carousel with the most native feeling you will get.
 * https://keen-slider.io
 * Copyright 2020-2021 Eric Beyer <contact@ericbeyer.de>
 * License: MIT
 * Released on: 2021-06-10
 */

function KeenSlider(initialContainer, initialOptions = {}) {
  const attributeMoving = 'data-keen-slider-moves'
  const attributeVertical = 'data-keen-slider-v'

  let container
  let events = []
  let observers = []
  let touchControls
  let length
  let origin
  let slides
  let width
  let slidesPerView
  let spacing
  let resizeLastWidth
  let breakpointCurrent = null
  let optionsChanged = false
  let sliderCreated = false

  let trackCurrentIdx
  let trackPosition = 0
  let trackMeasurePoints = []
  let trackDirection
  let trackMeasureTimeout
  let trackSpeed
  let trackSlidePositions
  let trackProgress
  let mounted = false

  let options
  let dotsContainer = false
  let pageInfoContainer = false
  let navBar = false
  let prevButton = false
  let nextButton = false
  let autoplayInterval = 0
  let automoveInterval = 0

  // touch/swipe helper
  let touchIndexStart
  let touchActive
  let touchIdentifier
  let touchLastX
  let touchLastClientX
  let touchLastClientY
  let touchMultiplicator
  let touchJustStarted
  let touchSumDistance
  let touchChecked

  // animation
  let reqId
  let startTime
  let moveDistance
  let moveDuration
  let moveEasing
  let moved
  let moveForceFinish
  let moveCallBack

  // scroll helpers
  let scrollActive
  let scrollStartPageY
  let scrollStartPageX

  function throttle(t,n){var u=!1,i=null;return function(){u?i=function(){t.apply(this,arguments)}:(t.apply(this,arguments),u=!0,setTimeout((function(){u=!1,i&&(i(),i=null)}),n))}}

  function eventAdd(element, event, handler, options = {}) {
    element.addEventListener(event, handler, options)
    events.push([element, event, handler, options])
  }

  function observe(event, handler) {
    observers.push([event, handler]);
  }

  function emit(event) {
    observers.filter(x=>x[0]==event).forEach((observer)=>{
      observer[1]();
    });
  }

  function eventDrag(e, fromWheel=false) {
    if (
      !touchActive ||
      touchIdentifier !== eventGetIdentifier(e) ||
      !isTouchable() ||
      (scrollActive && !fromWheel)
    )
      return
    const x = eventGetX(e).x
    if (!eventIsSlide(e) && touchJustStarted) {
      return eventDragStop(e)
    }
    if (touchJustStarted) {
      trackMeasureReset()
      touchLastX = x
      touchJustStarted = false
    }
    if (e.cancelable) e.preventDefault()
    const touchDistance = touchLastX - x
    touchSumDistance += Math.abs(touchDistance)
    if (!touchChecked && touchSumDistance > 5) {
      touchChecked = true
      container.setAttribute(attributeMoving, true)
    }
    trackAdd(
      touchMultiplicator(touchDistance, pubfuncs) * (!isRtl() ? 1 : -1),
      e.timeStamp
    )

    touchLastX = x
  }

  function eventDragStart(e) {
    if (touchActive || !isTouchable() || eventIsIgnoreTarget(e.target)) return
    touchActive = true
    touchJustStarted = true
    touchIdentifier = eventGetIdentifier(e)
    touchChecked = false
    touchSumDistance = 0
    eventIsSlide(e)
    moveAnimateAbort()
    touchIndexStart = trackCurrentIdx
    touchLastX = eventGetX(e).x
    trackAdd(0, e.timeStamp)
    hook('dragStart')
  }

  function eventDragStop(e) {
    if (
      !touchActive ||
      touchIdentifier !== eventGetIdentifier(e, true) ||
      !isTouchable()
    )
      return
    container.removeAttribute(attributeMoving)
    touchActive = false
    moveWithSpeed()
    hook('dragEnd')
  }

  function eventGetChangedTouches(e) {
    return e.changedTouches
  }

  function eventGetIdentifier(e, changedTouches = false) {
    const touches = changedTouches
      ? eventGetChangedTouches(e)
      : eventGetTargetTouches(e)
    return !touches ? 'default' : touches[0] ? touches[0].identifier : 'error'
  }

  function eventGetTargetTouches(e) {
    return e.targetTouches
  }

  function eventGetX(e) {
    const touches = eventGetTargetTouches(e)
    return {
      x: isVerticalSlider()
        ? !touches
          ? e.pageY
          : touches[0].screenY
        : !touches
        ? e.pageX
        : touches[0].screenX,
      timestamp: e.timeStamp,
    }
  }

  function eventIsIgnoreTarget(target) {
    return target.hasAttribute(options.preventEvent)
  }

  function eventIsSlide(e) {
    const touches = eventGetTargetTouches(e)
    if (!touches) return true
    const touch = touches[0]
    const x = isVerticalSlider() ? touch.clientY : touch.clientX
    const y = isVerticalSlider() ? touch.clientX : touch.clientY
    const isSlide =
      touchLastClientX !== undefined &&
      touchLastClientY !== undefined &&
      Math.abs(touchLastClientY - y) <= Math.abs(touchLastClientX - x)

    touchLastClientX = x
    touchLastClientY = y
    return isSlide
  }

  function eventWheel(e) {
    if (!isTouchable()) return
    let absDeltaX = Math.abs(e.deltaX);
    let absDeltaY = Math.abs(e.deltaY);
    if (isVerticalSlider() && (absDeltaY<=absDeltaX)) {
      return;
    } else {
      if (!isVerticalSlider() && (absDeltaX<=absDeltaY)) {
        return;
      }
    }
    e.preventDefault()

    if (!touchActive) {
      scrollStartPageX = e.pageX
      scrollStartPageY = e.pageY
      eventDragStart({
        target: e.target,
        pageX: scrollStartPageX,
        pageY: scrollStartPageY,
      })
    }
    scrollStartPageX -= e.deltaX
    scrollStartPageY -= e.deltaY
    eventDrag(
      {
        target: e.target,
        pageX: scrollStartPageX,
        pageY: scrollStartPageY,
      },
      true
    )
    clearTimeout(scrollActive)
    scrollActive = setTimeout(function () {
      eventDragStop({
        target: e.target,
      })
      scrollActive = null
    }, 100)
  }

  function eventsAdd() {
    eventAdd(window, 'orientationchange', sliderResizeFix)
    eventAdd(window, 'layoutChange', sliderLayoutChangeFix)
    eventAdd(window, 'resize', () => sliderResize())
    if(options.drag) {
      eventAdd(container, 'dragstart', function (e) {
        if (!isTouchable()) return
        e.preventDefault()
      })
      eventAdd(container, 'mousedown', eventDragStart)
      eventAdd(options.cancelOnLeave ? container : window, 'mousemove', eventDrag)
      if (options.cancelOnLeave) eventAdd(container, 'mouseleave', eventDragStop)
      eventAdd(window, 'mouseup', eventDragStop)
      eventAdd(container, 'touchstart', eventDragStart, {
        passive: true,
      })
      eventAdd(container, 'touchmove', eventDrag, {
        passive: false,
      })
      eventAdd(container, 'touchend', eventDragStop, {
        passive: true,
      })
      eventAdd(container, 'touchcancel', eventDragStop, {
        passive: true,
      })
    }
    if(options.wheel) {
      eventAdd(container, 'wheel', eventWheel, {
        passive: false,
      })
    }
  }

  function eventsRemove() {
    events.forEach(event => {
      event[0].removeEventListener(event[1], event[2], event[3])
    })
    events = []
  }

  function hook(hook) {
    if (options[hook]) options[hook](pubfuncs)
    emit(hook);
    if(container) {
      let event = new Event('keen.'+hook);
      container.dispatchEvent(event);
    }
  }

  function isCenterMode() {
    return options.centered && Math.ceil(options.slidesPerView)<slides.length
  }

  function isTouchable() {
    return touchControls !== undefined ? touchControls : options.controls
  }

  function isLoop() {
    return options.loop && length > Math.ceil(options.slidesPerView)
  }

  function isRtl() {
    return options.rtl
  }

  function isRubberband() {
    return !options.loop && options.rubberband && !scrollActive
  }

  function isVerticalSlider() {
    return !!options.vertical
  }

  function moveAnimate() {
    reqId = window.requestAnimationFrame(moveAnimateUpdate)
  }

  function moveAnimateAbort() {
    if (reqId) {
      window.cancelAnimationFrame(reqId)
      reqId = null
    }
    startTime = null
  }

  function moveAnimateUpdate(timestamp) {
    if (!startTime) startTime = timestamp
    const duration = timestamp - startTime
    let add = moveCalcValue(duration)
    if (duration >= moveDuration) {
      trackAdd(moveDistance - moved, false)
      if (moveCallBack) return moveCallBack()
      hook('afterChange')
      return
    }

    const offset = trackCalculateOffset(add)
    if (offset !== 0 && !isLoop() && !isRubberband() && !moveForceFinish) {
      trackAdd(add - offset, false)
      return
    }
    if (offset !== 0 && isRubberband() && !moveForceFinish) {
      return moveRubberband(Math.sign(offset))
    }
    moved += add
    trackAdd(add, false)
    moveAnimate()
  }

  function moveCalcValue(progress) {
    const value = moveDistance * moveEasing(progress / moveDuration) - moved
    return value
  }

  function moveWithSpeed() {
    hook('beforeChange')
    switch (options.mode) {
      case 'free':
        moveFree()
        break
      case 'free-snap':
        moveSnapFree()
        break
      case 'snap':
      default:
        moveSnapOne()
        break
    }
  }

  function moveSnapOne() {
    const startIndex =
      slidesPerView === 1 && trackDirection !== 0
        ? touchIndexStart
        : trackCurrentIdx
    moveToIdx(startIndex + Math.sign(trackDirection))
  }

  function moveToIdx(
    idx,
    forceFinish,
    duration = options.duration,
    relative = false,
    nearest = false
  ) {
    // forceFinish is used to ignore boundaries when rubberband movement is active

    idx = trackGetIdx(idx, relative, nearest)
    const easing = t => 1 + --t * t * t * t * t
    moveTo(trackGetIdxDistance(idx), duration, easing, forceFinish)
  }

  function moveFree() {
    // todo: refactor!
    if (trackSpeed === 0)
      return trackCalculateOffset(0) && !isLoop()
        ? moveToIdx(trackCurrentIdx)
        : false
    const friction = options.friction / Math.pow(Math.abs(trackSpeed), -0.5)
    const distance =
      (Math.pow(trackSpeed, 2) / friction) * Math.sign(trackSpeed)
    const duration = Math.abs(trackSpeed / friction) * 6
    const easing = function (t) {
      return 1 - Math.pow(1 - t, 5)
    }
    moveTo(distance, duration, easing)
  }

  function moveSnapFree() {
    // todo: refactor!
    if (trackSpeed === 0) return moveToIdx(trackCurrentIdx)
    const friction = options.friction / Math.pow(Math.abs(trackSpeed), -0.5)
    const distance =
      (Math.pow(trackSpeed, 2) / friction) * Math.sign(trackSpeed)
    const duration = Math.abs(trackSpeed / friction) * 6
    const easing = function (t) {
      return 1 - Math.pow(1 - t, 5)
    }
    const idx_trend = (trackPosition + distance) / (width / slidesPerView)
    const idx =
      trackDirection === -1 ? Math.floor(idx_trend) : Math.ceil(idx_trend)
    moveTo(idx * (width / slidesPerView) - trackPosition, duration, easing)
  }

  function moveRubberband() {
    moveAnimateAbort()
    // todo: refactor!
    if (trackSpeed === 0) return moveToIdx(trackCurrentIdx, true)
    const friction = 0.04 / Math.pow(Math.abs(trackSpeed), -0.5)
    const distance =
      (Math.pow(trackSpeed, 2) / friction) * Math.sign(trackSpeed)

    const easing = function (t) {
      return --t * t * t + 1
    }

    const speed = trackSpeed
    const cb = () => {
      moveTo(
        trackGetIdxDistance(trackGetIdx(trackCurrentIdx)),
        500,
        easing,
        true
      )
    }
    moveTo(distance, Math.abs(speed / friction) * 3, easing, true, cb)
  }

  function moveTo(distance, duration, easing, forceFinish, cb) {
    moveAnimateAbort()
    moveDistance = distance
    moved = 0
    moveDuration = duration
    moveEasing = easing
    moveForceFinish = forceFinish
    moveCallBack = cb
    startTime = null
    moveAnimate()
  }

  function sliderBind(force_resize) {
    let _container = getElements(initialContainer)
    if (!_container.length) return
    container = _container[0]
    hook('beforeMount')
    sliderResize(force_resize)
    eventsAdd()
    hook('mounted')
  }

  function sliderCheckBreakpoint(rebind=true) {
    const breakpoints = initialOptions.breakpoints || []
    let lastValid
    for (let value in breakpoints) {
      if (window.matchMedia(value).matches) lastValid = value
    }
    if (lastValid === breakpointCurrent) return true
    breakpointCurrent = lastValid
    const _options = breakpointCurrent
      ? breakpoints[breakpointCurrent]
      : initialOptions
    if (_options.breakpoints && breakpointCurrent) delete _options.breakpoints
    options = { ...defaultOptions, ...initialOptions, ..._options }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      options.duration = 0;
      options.automove = 0;
    }
    optionsChanged = true
    resizeLastWidth = null

    if(rebind) {
      hook('optionsChanged')
      sliderRebind()
    }
  }

  function sliderGetSlidesPerView(option) {
    if (typeof option === 'function') return option()
    const adjust = options.autoAdjustSlidesPerView
    if (!adjust) length = Math.max(option, length)
    const max = isLoop() && adjust ? length - 1 : length
    return clampValue(option, 1, Math.max(max, 1))
  }

  function sliderInit() {
    let _container = getElements(initialContainer)
    if (!_container.length) return
    container = _container[0]

    initADA()
    initDots()
    initPageInfo()
    initNavBar()
    initPrevNextButtons()
    initAutoplay()
    initAutomove()

    observe('beforeMount', function(){
      container.classList.add('initialized')

      if(options.vertical) {
        container.classList.add('vertical')
      }
      if(options.customAnimation) {
        container.classList.add('custom-animation', options.customAnimation)
      }
    })
    observe('mounted', function(){
      mounted = true;

      if(options.centered && options.slidesPerView>slides.length && !options.autoAdjustSlidesPerView) {
        var translate = ((slides.length-1)*spacing)/2;
        if(isVerticalSlider()) {
          container.style.transform = 'translateY(-'+translate+'px)';
        } else {
          container.style.transform = 'translateX(-'+translate+'px)';
        }
        container.classList.add('justify-content-center')
      }
    })
    observe('destroyed', function(){
      mounted = false;
      if(options.customAnimation) {
        container.classList.remove('custom-animation', options.customAnimation)  
      }
      container.classList.remove('initialized', 'vertical', 'justify-content-center')
      container.style.removeProperty('transform')
    })
    observe('move', function(){
      slidesRefreshActiveClass()
    })
    
    sliderCheckBreakpoint()
    sliderCreated = true
    hook('created')
  }

  function isVisible(element) {
    return !!(element.offsetWidth || element.offsetHeight || element.getClientRects().length);
  }

  function getVisibleSlides() {
    return getElements(options.slides, container).filter(x=>isVisible(x));
  }

  function sliderRebind(new_options, force_resize) {
    if (new_options) initialOptions = new_options
    if (force_resize) breakpointCurrent = null
    sliderUnbind()
    sliderBind(force_resize)
  }

  function sliderResize(force) {
    const windowWidth = window.innerWidth
    if (!force && (!sliderCheckBreakpoint(!force) || (windowWidth === resizeLastWidth)))
      return
    resizeLastWidth = windowWidth
    slides = getVisibleSlides()
    length = slides ? slides.length : 0
    if (!options.carousel || options.customAnimation) {
      slides = null
    }
    const dragSpeed = options.dragSpeed
    touchMultiplicator =
      typeof dragSpeed === 'function' ? dragSpeed : val => val * dragSpeed
    let containerComputedStyle = window.getComputedStyle(container)
    width = isVerticalSlider() ? containerComputedStyle.height : containerComputedStyle.width
    width = parseFloat(width)
    slidesPerView = sliderGetSlidesPerView(options.slidesPerView)
    spacing = clampValue(options.spacing, 0, width / (slidesPerView - 1) - 1)
    width += spacing
    origin = isCenterMode()
      ? (width / 2 - width / slidesPerView / 2) / width
      : 0
    slidesSetWidths()

    const currentIdx =
      !sliderCreated || (optionsChanged && options.resetSlide)
        ? options.initial
        : trackCurrentIdx
    trackSetPositionByIdx(isLoop() ? currentIdx : trackClampIndex(currentIdx))

    if (isVerticalSlider()) {
      container.setAttribute(attributeVertical, true)
    }
    optionsChanged = false
    
    if(options.setContainerHeight)
      setContainerHeight()
  }

  function sliderResizeFix() {
    sliderResize()
    setTimeout(sliderResize, 500)
    setTimeout(sliderResize, 2000)
  }

  function sliderLayoutChangeFix(e) {
    if (e.detail && e.detail.target && e.detail.target.contains(container)) {
      sliderResize(true)
    } 
  }

  function sliderUnbind() {
    eventsRemove()
    slidesRemoveStyles()
    if (container && container.hasAttribute(attributeVertical))
      container.removeAttribute(attributeVertical)
    hook('destroyed')
  }

  function slidesSetPositions() {
    if (!slides) return
    slides.forEach((slide, idx) => {
      const absoluteDistance = trackSlidePositions[idx].distance * width
      const pos =
        absoluteDistance -
        idx *
          (width / slidesPerView -
            spacing / slidesPerView -
            (spacing / slidesPerView) * (slidesPerView - 1))

      const x = isVerticalSlider() ? 0 : pos
      const y = isVerticalSlider() ? pos : 0
      const transformString = `translate3d(${x}px, ${y}px, 0)`
      slide.style.transform = transformString
      slide.style['-webkit-transform'] = transformString
    })
  }

  function slidesSetWidths() {
    if (!slides) return
    slides.forEach(slide => {
      const offset = (spacing / slidesPerView) * (slidesPerView - 1);
      var style;
      if(offset>0) {
        style = `calc(${100 / slidesPerView}% - ${offset}px)`
      } else {
        style = `${100 / slidesPerView}%`
      }
      if (isVerticalSlider()) {
        slide.style['min-height'] = style
        slide.style['max-height'] = style
        slide.style['min-width'] = ''
        slide.style['max-width'] = ''
      } else {
        slide.style['min-width'] = style
        slide.style['max-width'] = style
        slide.style['min-height'] = ''
        slide.style['max-height'] = ''
      }
    })
  }

  function slidesRemoveStyles() {
    if (!slides) return
    let styles = ['transform', '-webkit-transform']
    styles = isVerticalSlider()
      ? [...styles, 'min-height', 'max-height']
      : [...styles, 'min-width', 'max-width']
    slides.forEach(slide => {
      styles.forEach(style => {
        slide.style.removeProperty(style)
      })
      if(slide.classList.contains('active'))
        slide.classList.remove('active')
    })
  }

  function trackAdd(val, drag = true, timestamp = Date.now()) {
    trackMeasure(val, timestamp)
    if (drag) val = trackrubberband(val)
    trackPosition += val
    trackMove()
  }

  function trackCalculateOffset(add) {
    const trackLength =
      (width * (length - 1 * (isCenterMode() ? 1 : slidesPerView))) /
      slidesPerView
    const position = trackPosition + add
    return position > trackLength
      ? position - trackLength
      : position < 0
      ? position
      : 0
  }

  function trackClampIndex(idx) {
    return clampValue(
      idx,
      0,
      length - 1 - (isCenterMode() ? 0 : slidesPerView - 1)
    )
  }

  function trackGetDetails() {
    const trackProgressAbs = Math.abs(trackProgress)
    const progress = trackPosition < 0 ? 1 - trackProgressAbs : trackProgressAbs
    return {
      direction: trackDirection,
      progressTrack: progress,
      progressSlides: (progress * length) / (length - 1),
      positions: trackSlidePositions,
      position: trackPosition,
      speed: trackSpeed,
      relativeSlide: ((trackCurrentIdx % length) + length) % length,
      absoluteSlide: trackCurrentIdx,
      size: length,
      slidesPerView,
      widthOrHeight: width,
    }
  }

  function trackGetIdx(idx, relative = false, nearest = false) {
    return !isLoop()
      ? trackClampIndex(idx)
      : !relative
      ? idx
      : trackGetRelativeIdx(idx, nearest)
  }

  function trackGetIdxDistance(idx) {
    return -(-((width / slidesPerView) * idx) + trackPosition)
  }

  function trackGetRelativeIdx(idx, nearest) {
    idx = ((idx % length) + length) % length
    const current = ((trackCurrentIdx % length) + length) % length
    const left = current < idx ? -current - length + idx : -(current - idx)
    const right = current > idx ? length - current + idx : idx - current
    const add = nearest
      ? Math.abs(left) <= right
        ? left
        : right
      : idx < current
      ? left
      : right
    return trackCurrentIdx + add
  }

  function trackMeasure(val, timestamp) {
    // todo - improve measurement - it could be better for ios
    clearTimeout(trackMeasureTimeout)
    const direction = Math.sign(val)
    if (direction !== trackDirection) trackMeasureReset()
    trackDirection = direction
    trackMeasurePoints.push({
      distance: val,
      time: timestamp,
    })
    trackMeasureTimeout = setTimeout(() => {
      trackMeasurePoints = []
      trackSpeed = 0
    }, 50)
    trackMeasurePoints = trackMeasurePoints.slice(-6)
    if (trackMeasurePoints.length <= 1 || trackDirection === 0)
      return (trackSpeed = 0)

    const distance = trackMeasurePoints
      .slice(0, -1)
      .reduce((acc, next) => acc + next.distance, 0)
    const end = trackMeasurePoints[trackMeasurePoints.length - 1].time
    const start = trackMeasurePoints[0].time
    trackSpeed = clampValue(distance / (end - start), -10, 10)
  }

  function trackMeasureReset() {
    trackMeasurePoints = []
  }

  // todo - option for not calculating slides that are not in sight
  function trackMove() {
    trackProgress = isLoop()
      ? (trackPosition % ((width * length) / slidesPerView)) /
        ((width * length) / slidesPerView)
      : trackPosition / ((width * length) / slidesPerView)

    trackSetCurrentIdx()
    const slidePositions = []
    for (let idx = 0; idx < length; idx++) {
      let distance =
        (((1 / length) * idx -
          (trackProgress < 0 && isLoop() ? trackProgress + 1 : trackProgress)) *
          length) /
          slidesPerView +
        origin
      if (isLoop())
        distance +=
          distance > (length - 1) / slidesPerView
            ? -(length / slidesPerView)
            : distance < -(length / slidesPerView) + 1
            ? length / slidesPerView
            : 0

      const slideWidth = 1 / slidesPerView
      const left = distance + slideWidth
      const portion =
        left < slideWidth
          ? left / slideWidth
          : left > 1
          ? 1 - ((left - 1) * slidesPerView) / 1
          : 1
      slidePositions.push({
        portion: portion < 0 || portion > 1 ? 0 : portion,
        distance: !isRtl() ? distance : distance * -1 + 1 - slideWidth,
      })
    }
    trackSlidePositions = slidePositions
    slidesSetPositions()
    hook('move')
  }

  function trackrubberband(add) {
    if (isLoop()) return add
    const offset = trackCalculateOffset(add)
    if (!isRubberband()) return add - offset
    if (offset === 0) return add
    const easing = t => (1 - Math.abs(t)) * (1 - Math.abs(t))
    return add * easing(offset / width)
  }

  function trackSetCurrentIdx() {
    const new_idx = Math.round(trackPosition / (width / slidesPerView))
    if (new_idx === trackCurrentIdx && mounted) return
    if (!isLoop() && (new_idx < 0 || new_idx > length - 1)) return
    trackCurrentIdx = new_idx
    hook('slideChanged')
  }

  function trackSetPositionByIdx(idx) {
    hook('beforeChange')
    trackAdd(trackGetIdxDistance(idx), false)
    hook('afterChange')
  }
  
  function initADA() {
    observe('mounted', function(){
      slidesRefreshADA()
      eventAdd(container, 'keydown', function(e){
        if(!e.target.getAttribute('type') || e.target.getAttribute('type').toLowerCase()!='radio') {
          if(e.keyCode==37) { //left
            pubfuncs.prev();
          }
          if(e.keyCode==39) { //right
            pubfuncs.next();
          }
        }
      })
    });
    observe('afterChange', function(){
      slidesRefreshADA()
    });
    observe('destroyed', function(){
      slidesRemoveADA()
    });
  }
  
  function slidesRefreshADA() {
    var _slides = slides || getVisibleSlides();
    _slides.forEach(function(slide, key){
      let focusableElements = Array.from(slide.querySelectorAll('a,input,select,button,textarea,video,iframe,.btn,.focusable')).filter(x=>!x.closest('.ignore-slide-tabindex'));

      if(trackSlidePositions[key].portion>0.9) { //active slides
        slide.setAttribute('aria-hidden', 'false');
        if(focusableElements.length==0) {
          slide.setAttribute('tabindex', '0');
        } else {
          focusableElements.forEach(function(obj){
            obj.setAttribute('tabindex', '0')
          });
        }
      } else { //inactive slides
        slide.setAttribute('aria-hidden', 'true');
        slide.setAttribute('tabindex', '-1');
        focusableElements.forEach(function(obj){
          obj.setAttribute('tabindex', '-1')
        });
      }
    });
    if(options.customAnimation) {
      if(container && container.contains(document.activeElement)) {
        let activeSlide = _slides[trackGetDetails().relativeSlide];
        if(activeSlide.getAttribute('tabindex')=='0') {
          activeSlide.focus()
        } else {
          activeSlide.querySelector('[tabindex="0"]').focus()
        }
      }
    }
  }
  
  function slidesRemoveADA() {
    if(sliderCreated) {
      let _slides = slides || container.querySelectorAll(options.slides);
      _slides.forEach(slide => {
        slide.querySelectorAll('[tabindex]').forEach(focusable => {
          focusable.removeAttribute('tabindex')
        })
        slide.removeAttribute('aria-hidden')
        slide.removeAttribute('tabindex')
      })
    }
  }
  
  function slidesRefreshActiveClass() {
    if(trackSlidePositions) {
      var _slides = slides || getVisibleSlides();
      var activeThreshold = (options.slidesPerView<2 ? 0.5 : 0.9);
      _slides.forEach(function(slide, key){
        if(trackSlidePositions[key].portion>activeThreshold) { //active slides
          slide.classList.add(options.slidesActiveClass);
        } else {
          slide.classList.remove(options.slidesActiveClass);
        }
      });
    }
  }

  function initDots() {
    observe('mounted', function(){
      buildDots()
    });
    observe('destroyed', function(){
      removeDots()
    });
    observe('slideChanged', function(){
      dotsRefreshClass()
    });
  }
  
  function buildDots() {
    if(options.dots) {
      let _trackDetails = trackGetDetails()
      const slidesPerView = _trackDetails.slidesPerView
      var size = _trackDetails.size

      if(size>1 && size>slidesPerView) {
        if(!isLoop() && !isCenterMode()) {
          size = size - slidesPerView + 1;
        }
        dotsContainer = getElements(options.dots)
        if(!dotsContainer.length) return
        dotsContainer = dotsContainer[0]

        for(let idx=0; idx<size; idx++) {
          var dot = document.createElement("button")
          dot.classList.add("keen-dots-dot")
          dot.setAttribute('type', 'button')
          dot.setAttribute('aria-label', 'Go to slide '+(idx+1))
          dotsContainer.appendChild(dot)
          dot.addEventListener("click", function(){
            moveToIdx(idx, true, (options.customAnimation ? 0 : options.duration), true)
          })
        }
        if (options.pageInfo && options.pageInfo.parentNode==dotsContainer) {
          dotsContainer.appendChild(options.pageInfo); //move sliderPage to the end of child items array
        }

        dotsRefreshClass()
      }
    }
  }
  
  function removeDots() {
    if(dotsContainer)
      dotsContainer.querySelectorAll('.keen-dots-dot').forEach(function(dot){
        dot.remove()
      })
  }
  
  function dotsRefreshClass() {
    if(dotsContainer) {
      var slide = trackGetDetails().relativeSlide
      var dots = dotsContainer.querySelectorAll(".keen-dots-dot")
      dots.forEach(function (dot, idx) {
        idx === slide ? dot.classList.add("active") : dot.classList.remove("active")
      })
    }
  }
  
  function initPageInfo() {
    observe('mounted', function(){
      buildPageInfo()
    });
    observe('destroyed', function(){
      removePageInfo()
    });
    observe('slideChanged', function(){
      updatePageInfo()
    });
  }

  function buildPageInfo() {
    if (options.pageInfo) {
      pageInfoContainer = getElements(options.pageInfo)[0];
      updatePageInfo();
    }
    
  }
  
  function removePageInfo() {
    if (pageInfoContainer) {
      pageInfoContainer.innerHTML = '';
      pageInfoContainer = null;
    }
  }
  
  function updatePageInfo() {
    if (pageInfoContainer) {
      let _trackDetails = trackGetDetails()
      let slide = _trackDetails.relativeSlide
      const slidesPerView = _trackDetails.slidesPerView
      var size = _trackDetails.size
      pageInfoContainer.innerHTML = '';

      if(size>1 && size>slidesPerView) {
        if(!isLoop() && !isCenterMode()) {
          size = size - slidesPerView + 1;
        }
        size = Math.ceil(size/options.slidesToScroll);
        slide = Math.floor(slide/options.slidesToScroll) + 1;
        pageInfoContainer.style.setProperty('--keen-slider-page-length', size.toString().length);
        pageInfoContainer.innerHTML = `<span class="keen-page-current">${slide.toString().padStart(size.toString().length, '0')}</span><span class="bar">/</span><span class="keen-page-total">${size}</span>`;
      } else {
        pageInfoContainer.innerHTML = '';
      }

    }
  }

  function prevButtonHandler() {
    moveToIdx(trackCurrentIdx - options.slidesToScroll, true)
  }
  
  function nextButtonHandler() {
    moveToIdx(trackCurrentIdx + options.slidesToScroll, true)
  }
  
  function initPrevNextButtons() {
    observe('mounted', function(){
      buildPrevNextButtons()
      prevNextButtonsRefreshClass()
    })
    observe('move', function(){
      prevNextButtonsRefreshClass()
    });
    observe('destroyed', function(){
      if(prevButton)
        prevButton.removeEventListener('click', prevButtonHandler);
      if(nextButton)
        nextButton.removeEventListener('click', nextButtonHandler);
    });
  }
  
  function buildPrevNextButtons() {
    prevButton = false
    if(options.prevButton) {
      prevButton = getElements(options.prevButton)
      if(prevButton.length) {
        prevButton = prevButton[0]
        prevButton.addEventListener("click", prevButtonHandler)
      }
    }
    nextButton = false
    if(options.nextButton) {
      nextButton = getElements(options.nextButton)
      if(nextButton.length) {
        nextButton = nextButton[0]
        nextButton.addEventListener("click", nextButtonHandler)
      }
    }
  }
  
  function prevNextButtonsRefreshClass() {
    if(prevButton || nextButton) {
      let _trackDetails = trackGetDetails()
      var slide = _trackDetails.relativeSlide
      var size = _trackDetails.size
      var slidesPerView = _trackDetails.slidesPerView
      if(prevButton) {
        if(size<=slidesPerView) {
          prevButton.classList.add('hide')
        } else {
          prevButton.classList.remove('hide')
        }
        if(slide==0 && !isLoop()) {
          prevButton.classList.add('disabled')
        } else {
          prevButton.classList.remove('disabled')
        }
      }
      if(nextButton) {
        if(isLoop()) {
          nextButton.classList.remove('hide', 'disabled')
        } else {
          if(size<=slidesPerView){
            nextButton.classList.add('hide')
          } else {
            nextButton.classList.remove('hide')
          }
          if((isCenterMode() && (slide+1)>=size) || (!isCenterMode() && (slide+slidesPerView)>=size)){
            nextButton.classList.add('disabled')
          } else {
            nextButton.classList.remove('disabled')
          }
        }
      }
    }
  }

  function initNavBar() {
    observe('mounted', function(){
      buildNavBar()
      navBarRefresh()
    })
    observe('move', function(){
      navBarRefresh()
    });
    observe('destroyed', function(){
      removeNavBar()
    });
  }

  function buildNavBar() {
    navBar = false
    if(options.navBar) {
      let navBarContainer = getElements(options.navBar)
      if(!navBarContainer.length) return
      navBarContainer = navBarContainer[0]
      navBar = document.createElement("div")
      navBar.classList.add("keen-nav-inner-bar")
      navBarContainer.appendChild(navBar)
    }
  }

  function navBarRefresh() {
    if(navBar) {
      var disabled = false
      var navBarContainer = navBar.parentNode
      var progress = trackGetDetails().progressTrack
      var position = trackGetDetails().position
      var barWidthOrHeight = 0;
      var margin = 0;

      progress = ((progress+0.0001)<1 && position>=0 ? progress : 0)

      if(options.navBarType=='scroll') {
        if(isLoop()) {
          barWidthOrHeight = (options.slidesPerView * 100) / ((length*2)-1)
          margin = (progress * (100 - barWidthOrHeight))
        } else {
          barWidthOrHeight = (options.slidesPerView * 100) / length
          margin = progress * 100
        }
        if(barWidthOrHeight>=100) {
          disabled = true
        }
      }

      if(options.navBarType=='progress') {
        let notVisiblePercentage = 100 - (options.slidesPerView * 100) / length
        if(notVisiblePercentage > 0) {
          barWidthOrHeight = 100 * (progress*100) / notVisiblePercentage
        } else {
          disabled = true
        }
      }

      if(barWidthOrHeight>100) {
        barWidthOrHeight = 100
      }
      if((barWidthOrHeight+margin) > 100) {
        margin = 100 - barWidthOrHeight
      }
      if(margin < 0) {
        margin = 0
      }

      if(disabled) {
        navBarContainer.classList.add('disabled');
      } else {
        navBarContainer.classList.remove('disabled');
        if(options.vertical) {
          navBar.style.height = barWidthOrHeight + '%'
          navBar.style['top'] = margin + '%'
        } else {
          navBar.style.width = barWidthOrHeight + '%'
          navBar.style['left'] = margin + '%'
        }
      }
    }
  }

  function removeNavBar() {
    if(navBar) {
      navBar.remove();
      navBar = false;
    }
  }
  
  function setContainerHeight() {
    if(!isVerticalSlider()) {
      var _slides = slides || getVisibleSlides();
      var maxHeight = 0;
      _slides.forEach(function(slide){
        maxHeight = slide.offsetHeight > maxHeight ? slide.offsetHeight : maxHeight;
      });
      container.style.height = maxHeight+'px';
    }
  }
  
  function initAutoplay() {
    observe('mounted', function(){
      if (options.pauseOnHover) {
        eventAdd(container, "mouseover", function(ev){
          autoplay(false)
        })
        eventAdd(container, "mouseout", function(ev){
          if(ev.relatedTarget!=container && !container.contains(ev.relatedTarget)) {
            autoplay(true)
          }
        })
      }
      window.addEventListener('scroll', throttle(playIfVisible, 300));
      playIfVisible();
    });
    observe('destroyed', function(){
      autoplay(false);
    });
    observe('dragStart', function(){
      autoplay(false)
    });
    observe('dragEnd', function(){
      autoplay(true)
    });
    observe('slideChanged', function(){
      autoplay(false)
    });
    observe('beforeChange', function(){
      autoplay(false)
    });
    observe('afterChange', function(){
      if (isInViewport(container)) {
        autoplay(true);
      }
    });
    var sliderInViewport = false;
    function playIfVisible() {
      let isInside = isInViewport(container);
      if (isInside != sliderInViewport) {
        sliderInViewport = isInside;
        autoplay(isInside);
      }
    }
  }
  
  function isInViewport(element){
    const {top, bottom} = element.getBoundingClientRect();
    const vHeight = (window.innerHeight || document.documentElement.clientHeight);
    return ((top>0 || bottom>0) && top<vHeight);
  }

  function autoplay(run) {
    clearInterval(autoplayInterval)
    if(run && options.autoplay>0) {
      autoplayInterval = setInterval(() => {
        moveToIdx(trackCurrentIdx + options.slidesToScroll, true)
      }, options.autoplay*1000)
    }
  }

  function initAutomove() {
    observe('mounted', function(){
      if (options.pauseOnHover) {
        eventAdd(container, "mouseover", function(ev){
          automove(false)
        })
        eventAdd(container, "mouseout", function(ev){
          if(ev.relatedTarget!=container && !container.contains(ev.relatedTarget)) {
            automove(true)
          }
        })
      }
      setTimeout(()=>{
        automove(true)
      }, 1000);
    });
    observe('destroyed', function(){
      automove(false);
    });
  }

  function automove(run) {
    clearInterval(automoveInterval)
    if(run && options.automove>0 && isLoop()) {
      automoveInterval = setInterval(()=>{
        trackAdd(options.automove, false)
      }, 10);
    }
  }
  
  // helper functions

  function convertToArray(nodeList) {
    return Array.prototype.slice.call(nodeList)
  }

  function getElements(element, wrapper = document) {
    return typeof element === 'function'
      ? convertToArray(element())
      : typeof element === 'string'
      ? convertToArray(wrapper.querySelectorAll(element))
      : element instanceof HTMLElement !== false
      ? [element]
      : element instanceof NodeList !== false
      ? element
      : []
  }

  function clampValue(value, min, max) {
    return Math.min(Math.max(value, min), max)
  }

  const defaultOptions = {
    autoAdjustSlidesPerView: false,
    centered: false,
    breakpoints: null,
    controls: true,
    dragSpeed: 1,
    friction: 0.0025,
    loop: false,
    initial: 0,
    duration: 500,
    preventEvent: 'data-keen-slider-pe',
    slides: '.keen-slider-slide',
    slidesActiveClass: 'active',
    vertical: false,
    resetSlide: false,
    slidesPerView: 1,
    spacing: 0,
    mode: 'snap',
    rtl: false,
    rubberband: true,
    cancelOnLeave: true,
    dots: false,
    navBar: false,
    navBarType: 'scroll',
    prevButton: false,
    nextButton: false,
    slidesToScroll: 1, //only for prev/next buttons
    customAnimation: false,
    carousel: true,
    setContainerHeight: false,
    autoplay: 0, //seconds
    automove: 0, //pixels
    pauseOnHover: true,
    wheel: true,
    drag: true
  }

  const pubfuncs = {
    controls: active => {
      touchControls = active
    },
    destroy: sliderUnbind,
    refresh(options) {
      sliderRebind(options, true)
    },
    next(_slidesToScroll) {
      moveToIdx(trackCurrentIdx + (_slidesToScroll || options.slidesToScroll), true)
    },
    prev(_slidesToScroll) {
      moveToIdx(trackCurrentIdx - (_slidesToScroll || options.slidesToScroll), true)
    },
    moveToSlide(idx, duration) {
      moveToIdx(idx, true, duration)
    },
    moveToSlideRelative(idx, nearest = false, duration) {
      moveToIdx(idx, true, duration, true, nearest)
    },
    autoplayStart() {
      autoplay(true)
    },
    autoplayStop() {
      autoplay(false)
    },
    resize() {
      sliderResize(true)
    },
    details() {
      return trackGetDetails()
    },
    options() {
      const opt = { ...options }
      delete opt.breakpoints
      return opt
    },
    slides() {
      return getElements(options.slides, container)
    },
    currentSlide() {
      return getVisibleSlides()[trackGetDetails().relativeSlide]
    },
  }

  sliderInit()

  return pubfuncs
}