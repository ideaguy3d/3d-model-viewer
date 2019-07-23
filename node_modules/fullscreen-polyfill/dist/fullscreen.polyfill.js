/*!
 * fullscreen-polyfill
 * 1.0.2 - 5/23/2018
 * https://github.com/nguyenj/fullscreen-polyfill#readme
 * (c) John Nguyen; MIT License
 */
var FullscreenPolyfill=function(){"use strict";var l=["fullscreen","fullscreenEnabled","fullscreenElement","fullscreenchange","fullscreenerror","exitFullscreen","requestFullscreen"],e=["webkitIsFullScreen","webkitFullscreenEnabled","webkitFullscreenElement","webkitfullscreenchange","webkitfullscreenerror","webkitExitFullscreen","webkitRequestFullscreen"],n=["mozFullScreen","mozFullScreenEnabled","mozFullScreenElement","mozfullscreenchange","mozfullscreenerror","mozCancelFullScreen","mozRequestFullScreen"],u=["","msFullscreenEnabled","msFullscreenElement","MSFullscreenChange","MSFullscreenError","msExitFullscreen","msRequestFullscreen"];document||(document={});var t,c=(t=[l[1],e[1],n[1],u[1]].find(function(e){return document[e]}),[l,e,n,u].find(function(e){return e.find(function(e){return e===t})})||[]);function r(e,n){document[l[0]]=document[c[0]]||!!document[c[2]]||!1,document[l[1]]=document[c[1]]||!1,document[l[2]]=document[c[2]]||null,document.dispatchEvent(new Event(e),n.target)}return document[l[1]]?{}:(document[l[0]]=document[c[0]]||!!document[c[2]]||!1,document[l[1]]=document[c[1]]||!1,document[l[2]]=document[c[2]]||null,document.addEventListener(c[3],r.bind(document,l[3]),!1),document.addEventListener(c[4],r.bind(document,l[4]),!1),document[l[5]]=function(){return document[c[5]]()},void(Element.prototype[l[6]]=function(){return this[c[6]].apply(this,arguments)}))}();
//# sourceMappingURL=fullscreen.polyfill.js.map
