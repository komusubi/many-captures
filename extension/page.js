// Copyright (c) 2010 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.
var page = {
  startX: 150,
  startY: 150,
  endX: 400,
  endY: 300,
  moveX: 0,
  moveY: 0,
  scrollbar: 17,
  pageWidth: 0,
  pageHeight: 0,
  visibleWidth: 0,
  visibleHeight: 0,
  dragging: false,
  moving: false,
  resizing: false,
  isMouseDown: false,
  scrollXCount: 0,
  scrollYCount: 0,
  scrollX: 0,
  scrollY: 0,
  captureHeight: 0,
  captureWeight: 0,
  winHeight: 0,
  winWidth: 0,
  isSelectionAreaTurnOn: false,
  isScrollBarX: false,
  isScrollBarY: false,
  fixedElements_ : [],
  marginTop: 0,
  marginLeft: 0,

  hookBodyScrollValue: function(needHook) {
    document.documentElement.setAttribute(
        "__screen_capture_need_hook_scroll_value__", needHook);
    var event = document.createEvent('Event');
    event.initEvent('__screen_capture_check_hook_status_event__', true, true);
    document.documentElement.dispatchEvent(event);
  },

  enableFixedPosition: function(enableFlag) {
    if (enableFlag) {
      for (var i = 0, l = this.fixedElements_.length; i < l; ++i) {
        this.fixedElements_[i].style.position = "fixed";
      }
    } else {
      this.fixedElements_ = [];
      var nodeIterator = document.createNodeIterator(
          document.documentElement,
          NodeFilter.SHOW_ELEMENT,
          null,
          false
      );
      var currentNode;
      while (currentNode = nodeIterator.nextNode()) {
        var nodeComputedStyle =
            document.defaultView.getComputedStyle(currentNode, "");
        // Skip nodes which don't have computeStyle or are invisible.
        if (!nodeComputedStyle)
          return;
        var nodePosition = nodeComputedStyle.getPropertyValue("position");
        if (nodePosition == "fixed") {
          this.fixedElements_.push(currentNode);
          currentNode.style.position = "absolute";
        }
      }
    }
  },

  checkPageIsOnlyEmbedElement: function() {
    var bodyNode = document.body.children;
    var isOnlyEmbed = false;
    for (var i = 0; i < bodyNode.length; i++) {
      var tagName = bodyNode[i].tagName;
      if (tagName == 'OBJECT' || tagName == 'EMBED' || tagName == 'VIDEO' ||
          tagName == 'SCRIPT' || tagName == 'LINK') {
        isOnlyEmbed = true;
      } else if (bodyNode[i].style.display != 'none'){
        isOnlyEmbed = false;
        break;
      }
    }
    return isOnlyEmbed;
  },

  isGMailPage: function(){
    var hostName = window.location.hostname;
    if (hostName == 'mail.google.com' &&
        document.getElementById('canvas_frame')) {
      return true;
    }
    return false;
  },

  /**
  * Receive messages from background page, and then decide what to do next
  */
  addMessageListener: function() {
    chrome.extension.onRequest.addListener(function(request, sender, response) {
      if (page.isSelectionAreaTurnOn) {
        page.removeSelectionArea();
      }
      switch (request.msg) {
        case 'capture_window': response(page.getWindowSize()); break;
        case 'show_selection_area': page.showSelectionArea(); break;
        case 'scroll_init':
          response(page.scrollInit(
              0, 0, document.width, document.height, 'captureWhole'));
          break;
        case 'scroll_next':
          page.visibleWidth = request.visibleWidth;
          page.visibleHeight = request.visibleHeight;
          response(page.scrollNext());
          break;
        case 'capture_selected':
          response(page.scrollInit(page.startX,
              page.startY, page.endX - page.startX, page.endY - page.startY,
              'captureSelected'));
          break;
      }
    });
  },

  /**
  * Send Message to background page
  */
  sendMessage: function(message) {
    chrome.extension.sendRequest(message);
  },

  /**
  * Initialize scrollbar position, and get the data browser
  */
  scrollInit: function(startX, startY, canvasWidth, canvasHeight, type) {
    this.enableFixedPosition(false);
    this.hookBodyScrollValue(true);
    page.captureHeight = canvasHeight;
    page.captureWidth = canvasWidth;
    var docWidth = document.width;
    var docHeight = document.height;
    window.scrollTo(startX, startY);

    var hostName = window.location.hostname;
    if (page.isGMailPage() && type == 'captureWhole') {
      var frame = document.getElementById('canvas_frame');
      docHeight = page.captureHeight = canvasHeight =
          frame.contentDocument.height;
      docWidth = page.captureWidth = canvasWidth = frame.contentDocument.width;
      frame.contentDocument.body.scrollTop = 0;
      frame.contentDocument.body.scrollLeft = 0;
    }
    page.scrollXCount = 0;
    page.scrollYCount = 1;
    page.scrollX = window.scrollX;
    page.scrollY = window.scrollY;
    return {
        'msg': 'scroll_init_done',
        'startX': startX,
        'startY': startY,
        'scrollX': window.scrollX,
        'scrollY': window.scrollY,
        'docHeight': docHeight,
        'docWidth': docWidth,
        'visibleWidth': document.documentElement.clientWidth,
        'visibleHeight': document.documentElement.clientHeight,
        'canvasWidth': canvasWidth,
        'canvasHeight': canvasHeight,
        'scrollXCount': 0,
        'scrollYCount': 0};
  },

  /**
  * Calculate the next position of the scrollbar
  */
  scrollNext: function() {
    if (page.scrollYCount * page.visibleWidth >= page.captureWidth) {
      page.scrollXCount++;
      page.scrollYCount = 0;
    }
    if (page.scrollXCount * page.visibleHeight < page.captureHeight) {
      var doc = document.documentElement;
      window.scrollTo(
          page.scrollYCount * doc.clientWidth + page.scrollX,
          page.scrollXCount * doc.clientHeight + page.scrollY);
      if (page.isGMailPage()) {
        var frame = document.getElementById('canvas_frame');
        frame.contentDocument.body.scrollLeft =
            page.scrollYCount * doc.clientWidth;
        frame.contentDocument.body.scrollTop =
            page.scrollXCount * doc.clientHeight;
      }
      var x = page.scrollXCount;
      var y = page.scrollYCount;
      page.scrollYCount++;
      return { msg: 'scroll_next_done',scrollXCount: x, scrollYCount: y };
    }  else {
      window.scrollTo(page.startX, page.startY);
      this.enableFixedPosition(true);
      this.hookBodyScrollValue(false);
      return {'msg': 'scroll_finished'};
    }
  },

  /**
  * Show the selection Area
  */
  showSelectionArea: function() {
    page.createFloatLayer();
    setTimeout(page.createSelectionArea, 100);
  },

  getWindowSize: function() {
    var docWidth = document.width;
    var docHeight = document.height;
    if (page.isGMailPage()) {
      var frame = document.getElementById('canvas_frame');
      docHeight = frame.contentDocument.height;
      docWidth = frame.contentDocument.width;
    }
    return {'msg':'capture_window',
            'docWidth': docWidth,
            'docHeight': docHeight};
  },

  getSelectionSize: function() {
    page.removeSelectionArea();
    setTimeout(function() {
      page.sendMessage({
        'msg': 'capture_selected',
        'x': page.startX,
        'y': page.startY,
        'width': page.endX - page.startX,
        'height': page.endY - page.startY,
        'visibleWidth': document.documentElement.clientWidth,
        'visibleHeight': document.documentElement.clientHeight,
        'docWidth': document.width,
        'docHeight': document.height
      })}, 100);
  },

  /**
  * Create a float layer on the webpage
  */
  createFloatLayer: function() {
    page.createDiv(document.body, 'sc_drag_area_protector');
  },
  
  matchMarginValue: function(str) {
    return str.match(/\d+/);
  },

  /**
  * Load the screenshot area interface
  */
  createSelectionArea: function() {
    var areaProtector = $('sc_drag_area_protector'); 
    var body_style = window.getComputedStyle(document.body,null);
    if ('relative' == body_style['position']) {
      page.marginTop = page.matchMarginValue(body_style['marginTop']);
      page.marginLeft = page.matchMarginValue(body_style['marginLeft']);
      areaProtector.style.top =  - parseInt(page.marginTop) + 'px';
      areaProtector.style.left =  - parseInt(page.marginLeft) + 'px';    
    }    
    areaProtector.style.width = (document.width + parseInt(page.marginLeft)) + 'px';
    areaProtector.style.height = (document.height + parseInt(page.marginTop)) + 'px';
    areaProtector.onclick = function() {
    event.stopPropagation();
    return false;
    };
    page.createDiv(areaProtector, 'sc_drag_shadow_top');
    page.createDiv(areaProtector, 'sc_drag_shadow_bottom');
    page.createDiv(areaProtector, 'sc_drag_shadow_left');
    page.createDiv(areaProtector, 'sc_drag_shadow_right');

    var areaElement = page.createDiv(areaProtector, 'sc_drag_area');
    page.createDiv(areaElement, 'sc_drag_container');
    page.createDiv(areaElement, 'sc_drag_size');

    var cancel = page.createDiv(areaElement, 'sc_drag_cancel');
    cancel.addEventListener('mousedown', function (){
        page.removeSelectionArea();}, true);
    cancel.innerHTML = chrome.i18n.getMessage("cancel");

    var crop = page.createDiv(areaElement, 'sc_drag_crop');
    crop.addEventListener('mousedown', function() {
      page.removeSelectionArea();
      page.sendMessage({msg: 'capture_selected'});
    }, false);
    crop.innerHTML = chrome.i18n.getMessage('ok');

    page.createDiv(areaElement, 'sc_drag_north_west');
    page.createDiv(areaElement, 'sc_drag_north_east');
    page.createDiv(areaElement, 'sc_drag_south_east');
    page.createDiv(areaElement, 'sc_drag_south_west');

    areaProtector.addEventListener('mousedown', page.onMouseDown, false);
    document.addEventListener('mousemove', page.onMouseMove, false);
    document.addEventListener('mouseup', page.onMouseUp, false);
    $('sc_drag_container').addEventListener('dblclick', function() {
      page.removeSelectionArea();
      page.sendMessage({msg: 'capture_selected'});
    }, false);

    page.pageHeight = $('sc_drag_area_protector').clientHeight;
    page.pageWidth = $('sc_drag_area_protector').clientWidth;

    var areaElement = $('sc_drag_area');
    areaElement.style.left = page.getElementLeft(areaElement) + 'px';
    areaElement.style.top = page.getElementTop(areaElement) + 'px';
    
    page.startX = page.getElementLeft(areaElement);
    page.startY = page.getElementTop(areaElement); 
    page.endX = page.getElementLeft(areaElement) + 250;
    page.endY = page.getElementTop(areaElement) + 150;
    
    areaElement.style.width = '250px';
    areaElement.style.height = '150px';
    page.isSelectionAreaTurnOn = true;
    page.updateShadow(areaElement);
    page.updateSize();
  },
  
  getElementLeft: function(obj) {
    return (document.body.scrollLeft +
        (document.documentElement.clientWidth - 
        obj.offsetWidth) / 2);
  },
  
  getElementTop: function(obj) {
    return (document.body.scrollTop + 
        (document.documentElement.clientHeight - 200 - 
        obj.offsetHeight) / 2);
  },

  /**
  * Init selection area due to the position of the mouse when mouse down
  */
  onMouseDown: function() {
    if (event.button != 2) {
      var element = event.target;

      if (element) {
        var elementName = element.tagName;
        if (elementName && document) {
          page.isMouseDown = true;

          var areaElement = $('sc_drag_area');
          var xPosition = event.pageX;
          var yPosition = event.pageY;

          if (areaElement) {
            if (element == $('sc_drag_container')) {
              page.moving = true;
              page.moveX = xPosition - areaElement.offsetLeft;
              page.moveY = yPosition - areaElement.offsetTop;
            } else if (element == $('sc_drag_north_east')) {
              page.resizing = true;
              page.startX = areaElement.offsetLeft;
              page.startY = areaElement.offsetTop + areaElement.clientHeight;
            } else if (element == $('sc_drag_north_west')) {
              page.resizing = true;
              page.startX = areaElement.offsetLeft + areaElement.clientWidth;
              page.startY = areaElement.offsetTop + areaElement.clientHeight;
            } else if (element == $('sc_drag_south_east')) {
              page.resizing = true;
              page.startX = areaElement.offsetLeft;
              page.startY = areaElement.offsetTop;
            } else if (element == $('sc_drag_south_west')) {
              page.resizing = true;
              page.startX = areaElement.offsetLeft + areaElement.clientWidth;
              page.startY = areaElement.offsetTop;
            } else {
              page.dragging = true;
              page.endX = 0;
              page.endY = 0;
              page.endX = page.startX = xPosition;
              page.endY = page.startY = yPosition;
            }
          }
          event.preventDefault();
        }
      }
    }
  },

  /**
  * Change selection area position when mouse moved
  */
  onMouseMove: function() {
    var element = event.target;
    if (element && page.isMouseDown) {
      var areaElement = $('sc_drag_area');
      if (areaElement) {
        var xPosition = event.pageX;
        var yPosition = event.pageY;
        if (page.dragging || page.resizing) {
          var width = 0;
          var height = 0;
          if (xPosition > document.width) {
            xPosition = document.width;
          }
          if (yPosition > document.height) {
            yPosition = document.height;
          }
          page.endX = xPosition;
          page.endY = yPosition;
          if (page.startX > page.endX) {
            width = page.startX - page.endX;
            areaElement.style.left = xPosition + 'px';
          } else {
            width = page.endX - page.startX;
            areaElement.style.left = page.startX + 'px';
          }
          if (page.startY > page.endY) {
            height = page.startY - page.endY;
            areaElement.style.top = page.endY + 'px';
          } else {
            height = page.endY - page.startY;
            areaElement.style.top = page.startY + 'px';
          }
          areaElement.style.height = height + 'px';
          areaElement.style.width  = width + 'px';
          if (window.innerWidth < xPosition) {
            document.body.scrollLeft = xPosition - window.innerWidth;
          }
          if (document.body.scrollTop + window.innerHeight < yPosition + 25) {
            document.body.scrollTop = yPosition - window.innerHeight + 25;
          }
          if (yPosition < document.body.scrollTop) {
            document.body.scrollTop -= 25;
          }
        } else if (page.moving) {
          var newXPosition = xPosition - page.moveX;
          var newYPosition = yPosition - page.moveY;
          if (newXPosition < 0) {
            newXPosition = 0;
          } else if (newXPosition + areaElement.clientWidth > page.pageWidth) {
            newXPosition = page.pageWidth - areaElement.clientWidth;
          }
          if (newYPosition < 0) {
            newYPosition = 0;
          } else if (newYPosition + areaElement.clientHeight >
                     page.pageHeight) {
            newYPosition = page.pageHeight - areaElement.clientHeight;
          }

          areaElement.style.left = newXPosition + 'px';
          areaElement.style.top = newYPosition + 'px';
          page.endX = newXPosition + areaElement.clientWidth;
          page.startX = newXPosition;
          page.endY = newYPosition + areaElement.clientHeight;
          page.startY = newYPosition;

        }
        var crop = document.getElementById('sc_drag_crop');
          var cancel = document.getElementById('sc_drag_cancel');
          if (event.pageY + 25 > document.height) {
            crop.style.bottom = 0;
            cancel.style.bottom = 0
          } else {
            crop.style.bottom = '-25px';
            cancel.style.bottom = '-25px';
          }
        page.updateShadow(areaElement);
        page.updateSize();

      }
    }
  },

 /**
  * Fix the selection area position when mouse up
  */
  onMouseUp: function()
  {
    page.isMouseDown = false;
    if (event.button != 2) {
      page.resizing = false;
      page.dragging = false;
      page.moving = false;
      page.moveX = 0;
      page.moveY = 0;
      var temp;
      if (page.endX < page.startX) {
        temp = page.endX;
        page.endX = page.startX;
        page.startX = temp;
      }
      if (page.endY < page.startY) {
        temp = page.endY;
        page.endY = page.startY;
        page.startY = temp;
      }
    }
  },

  /**
  * Update the location of the shadow layer
  */
  updateShadow: function(areaElement) {
    $('sc_drag_shadow_top').style.height =
        parseInt(areaElement.style.top) + 'px';
    $('sc_drag_shadow_top').style.width = (parseInt(areaElement.style.left) +
        parseInt(areaElement.style.width) + 1) + 'px';
    $('sc_drag_shadow_left').style.height =
        (page.pageHeight - parseInt(areaElement.style.top)) + 'px';
    $('sc_drag_shadow_left').style.width =
        parseInt(areaElement.style.left) + 'px';

    var height = (parseInt(areaElement.style.top) +
        parseInt(areaElement.style.height) + 1);
    height = (height < 0) ? 0 : height;
    var width = (page.pageWidth) - 1 - (parseInt(areaElement.style.left) +
        parseInt(areaElement.style.width));
    width = (width < 0) ? 0 : width;
    $('sc_drag_shadow_right').style.height = height + 'px';
    $('sc_drag_shadow_right').style.width =  width + 'px';

    height = (page.pageHeight - 1 - (parseInt(areaElement.style.top) +
        parseInt(areaElement.style.height)));
    height = (height < 0) ? 0 : height;
    width = (page.pageWidth) - parseInt(areaElement.style.left);
    width = (width < 0) ? 0 : width;
    $('sc_drag_shadow_bottom').style.height = height + 'px';
    $('sc_drag_shadow_bottom').style.width = width + 'px';
  },

  /**
  * Remove selection area
  */
  removeSelectionArea: function() {
    document.removeEventListener('mousedown', page.onMouseDown, false);
    document.removeEventListener('mousemove', page.onMouseMove, false);
    document.removeEventListener('mouseup', page.onMouseUp, false);
    $('sc_drag_container').removeEventListener('dblclick',function() {
      page.removeSelectionArea();
      page.sendMessage({msg: 'capture_selected'});}, false);
    page.removeElement('sc_drag_area_protector');
    page.removeElement('sc_drag_area');
    page.isSelectionAreaTurnOn = false;
  },

  /**
  * Refresh the size info
  */
  updateSize: function() {
    var width = (page.endX > page.startX) ? (page.endX - page.startX) :
        (page.startX - page.endX);
    var height = (page.endY > page.startY) ? (page.endY - page.startY) :
        (page.startY - page.endY);
    $('sc_drag_size').innerText = width + ' x ' + height;
  },

  /**
  * create div
  */
  createDiv: function(parent, id) {
    var divElement = document.createElement('div');
    divElement.id = id;
    parent.appendChild(divElement);
    return divElement;
  },

  /**
  * Remove an element
  */
  removeElement: function(id) {
    if($(id)) {
      $(id).parentNode.removeChild($(id));
    }
  },

  injectCssResource: function(cssResource) {
    var css = document.createElement('LINK');
    css.type = 'text/css';
    css.rel = 'stylesheet';
    css.href = chrome.extension.getURL(cssResource);
    (document.head || document.body || document.documentElement).
        appendChild(css);
  },

  injectJavaScriptResource: function(scriptResource) {
    var script = document.createElement("script");
    script.type = "text/javascript";
    script.charset = "utf-8";
    script.src = chrome.extension.getURL(scriptResource);
    (document.head || document.body || document.documentElement).
        appendChild(script);
  },

  /**
  * Remove an element
  */
  init: function() { 
    if (document.body.hasAttribute('screen_capture_injected')) {
      return;
    }
    if (isPageCapturable()) {
      chrome.extension.sendRequest({msg: 'page_capturable'});
    } else {
      chrome.extension.sendRequest({msg: 'page_uncapturable'});
    }
    this.injectCssResource('style.css');
    this.addMessageListener();
    this.injectJavaScriptResource("page_context.js");
  }
};

isPageCapturable = function() {
  return !page.checkPageIsOnlyEmbedElement();
}

function $(id) {
  return document.getElementById(id);
}

page.init();

var selfResizeEvent = window.onresize;

window.onresize = function() {
  if (selfResizeEvent) {
    selfResizeEvent();
  }
  if (page.isSelectionAreaTurnOn) {
    page.removeSelectionArea();
    page.showSelectionArea();
  }
};

var fbRedirectUrl = 'http://www.facebook.com/connect/login_success.html';
var pageHref = window.location.href;
if (pageHref.indexOf(fbRedirectUrl) == 0) {
  page.sendMessage({
    msg: 'access_token_result',
    site: 'facebook',
    url: pageHref
  });
}
