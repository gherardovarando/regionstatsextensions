// Copyright (c) 2017 Gherardo Varando (gherardo.varando@gmail.com)
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
'use strict'

let inside = function(point, region) {
  if (region.type === 'polygon' || region.type === 'rectangle') {
    return pointinpolygon(point, region.latlngs[0])
  } else if (region.type === 'circle') {
    return pointincircle(point, region.latlng, region.options.radius)
  } else {
    return false
  }
}

/**
 * check if a point is
 * @param  {latlng} point      the point to check
 * @param  {latlng} center     center of the circel
 * @param  {Number} [radius=1] radius of the circle
 * @return {logical}            whatever the point is inside the circle
 */
let pointincircle = function(point, center, radius = 1) {
  if (!point) return false
  if (!center) return false
  let q = (point.lat - center.lat) * (point.lat - center.lat)
  let p = (point.lng - center.lng) * (point.lng - center.lng)
  return (p + q < radius * radius)
}


/**
 * check if a given point is inside a polygon
 * @param  {array} point   lat lng object
 * @param  {polygon} polygon vector of lat lng objects
 * @return {logical} if the point is inside the polygon
 */
let pointinpolygon = function(point, polygon) {
  if (!polygon) {
    return true;
  }

  // ray-casting algorithm based on
  // http://www.ecse.rpi.edu/Homepages/wrf/Research/Short_Notes/pnpoly.html
  var x = point.lng,
    y = point.lat; // extract x and y form point

  //convert latlngs to a vector of coordinates
  var vs = polygon.map((p) => {
    return [p.lng, p.lat]
  });

  var inside = false; //initialize inside variable to false

  //ray-casting algorithm
  for (var i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    var xi = vs[i][0],
      yi = vs[i][1];
    var xj = vs[j][0],
      yj = vs[j][1];
    var intersect = ((yi > y) != (yj > y)) &&
      (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

let circleArea = function(radius){
  return (Math.PI * radius * radius)
}

/**
 * compute the area of a polygon
 * code from http://www.mathopenref.com/coordpolygonarea2.html
 * original from http://alienryderflex.com/polygon_area/
 *  Public-domain function by Darel Rex Finley, 2006.
 * @param  {array of ltlng} coords array of the vertex of the polygon
 * @return {number}        area of the polygon
 */
let polygonArea = function(coords) {
  coords = coords[0]; //lealfet 1 uncomment this line
  coords = coords.map(function(ltlng) {
    return ([ltlng.lat, ltlng.lng])
  });
  var numPoints = coords.length
  var area = 0; // Accumulates area in the loop
  var j = numPoints - 1; // The last vertex is the 'previous' one to the first

  for (var i = 0; i < numPoints; i++) {
    area = area + (coords[j][0] + coords[i][0]) * (coords[j][1] - coords[i][1])
    j = i //j is previous vertex to i
  }
  return Math.abs(area / 2);
}


/**
 * Compute the area
 * @param  {object} region region configuration object
 * @return {number}  the area computed
 */
let area = function(region) {
  if (!isRegion(region)) return NaN
  if (region.type === 'polygon' || region.type === 'rectangle') {
    return polygonArea(region.latlngs)
  } else if (region.type === 'circle') {
    return circleArea(region.options.radius || region.radius || 1)
  } else {
    return 0
  }
}


let isRegion = function(conf) {
  let regname = ['polygon', 'rectangle', 'circle']
  return (regname.includes(conf.type.toLowerCase()))
}


module.exports = {
area: area,
inside: inside,
isRegion: isRegion
}
