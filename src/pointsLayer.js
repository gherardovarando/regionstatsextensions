"use strict";
//use non-map convention x-y if v=coords x=v[0] y=v[1]
//
const Baby = require("babyparse");
const fss = require("fs");

function pointsLayer(configuration) {
    this.configuration = configuration;
    if (!this.configuration.basePath) {
        this.configuration.basePath = "";
    }
    this.options = {};
    let self = this;


    /**
     * check if a given point is inside a polygon
     * @param  {array} point   2 dimensions vector
     * @param  {polygon} polygon vector of 2dim vectors components,
     * @return {logical}
     */
    this.pointinpolygon = function(point,  polygon) {
        if (!polygon) {
            return true;
        }

        // ray-casting algorithm based on
        // http://www.ecse.rpi.edu/Homepages/wrf/Research/Short_Notes/pnpoly.html
        var x = point[0],
            y = point[1]; // extract x and y form point

        //convert latlngs to a vector of coordinates
        var vs = polygon;

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
    };

    this.getBounds = function(polygon) {
        if (polygon) {
            let b = {
                west: polygon[0][0],
                east: polygon[0][0],
                north: polygon[0][1],
                south: polygon[0][1]
            };
            for (var i in polygon) {
                b.west = Math.min(b.west, polygon[i][0]);
                b.east = Math.max(b.east, polygon[i][0]);
                b.north = Math.min(b.north, polygon[i][1]);
                b.south = Math.max(b.south, polygon[i][1]);
            }
            return b;
        } else {
            return polygon;
        }
    }

    // bounds is an object with .west .east .north and .south
    this.getReferences = function(bounds) {
        let tileSize = self.configuration.tileSize;
        let x0 = self.configuration.tilex0;
        let y0 = self.configuration.tiley0;
        if (bounds) {
            if (!x0) {
                x0 = 0;
            }

            if (!y0) {
                y0 = 0;
            }
            var temp = [];
            var xstart = Math.floor(bounds.west / tileSize);
            var xstop = Math.floor(bounds.east / tileSize);
            var ystart = Math.floor(bounds.north / tileSize);
            var ystop = Math.floor(bounds.south / tileSize);
            if (xstop===(bounds.east / tileSize) ) xstop--;
            if (ystop===(bounds.south / tileSize) ) ystop--;
            for (var i = xstart; i <= xstop; i++) {
                for (var j = ystart; j <= ystop; j++) {
                    //if (i>=0 && j>=0){
                    temp.push([i, j]);
                    //}
                }
            }

            var res = temp.map((coord) => {
                return ({
                    col: coord[0] + x0,
                    row: coord[1] + y0,
                    x: coord[0] * tileSize,
                    y: coord[1] * tileSize
                })
            });

            return (res);
        } else {
            return self.getReferences({
                west: 0,
                east: self.configuration.size,
                north: 0,
                south: self.configuration.size
            });
        }
    }


    this.countPoints = function(options) {
        let t0 = process.hrtime();

        let polygon = options.polygon;
        let complete = options.complete;
        let error = options.errorcl;
        let cl = options.cl;
        let bunch = options.bunch;
        let maxTiles = options.maxTiles;


        var references = self.getReferences(self.getBounds(polygon));
        var l = references.length;
        const tot = l;
        var pointsUrlTemplate = self.configuration.pointsUrlTemplate;
        let points = [];
        let N = 0;

        var step = function(point) {
            if (self.pointinpolygon([point[0], point[1]], polygon)) {
                N = N + 1;
                if (typeof cl === 'function' ) {
                    cl(point);
                }
            }
        };

        var end = function(num) {
            l = l - 1;
            if (bunch) {
                bunch(tot - l, tot);
            }
            if (l <= 0) {
                let t1 = process.hrtime(t0);
                if (complete) {
                    complete({
                        N: N,
                        tot: tot,
                        time: t1
                    });
                }
            }
        };


        var err = function(e) {
            if (error) {
                error(e);
            }
            l = l - 1;
            if (bunch) {
                bunch(tot - l, tot);
            }
            if (l <= 0) {
                let t1 = process.hrtime(t0);
                if (complete) {
                    complete({
                        N: N,
                        tot: tot,
                        time: t1
                    });
                }
            }
        };

        if (maxTiles) {
            maxTiles = Math.min(maxTiles, references.length);
        } else {
            maxTiles = references.length;
        }

        for (var tt = 0; tt < maxTiles; tt++) {

            self.readPoints(polygon, references[tt], step, err, end);
        }
    }

    this.readPoints = function(polygon, reference, step, error, end) {
        let num = 0;
        let url = self.configuration.pointsUrlTemplate;
        url = url.replace("{x}", reference.col);
        url = url.replace("{y}", reference.row);
        try {
            // if (this.isRemote()) {
            //     let contents = url;
            // } else {
            let contents = fss.readFileSync(url).toString();
            Baby.parse(contents, {
                dynamicTyping: true,
                fastMode: true,
                step: (results, parser) => {
                    step([results.data[0][0] + reference.x, results.data[0][1] + reference.y]);
                },
                complete: (results, file) => {
                    if (end) {
                        end(num);
                    }
                },
                error: (e, file) => {
                    if (error) {
                        error(e);
                    }
                }
            });
        } catch (e) {
            if (error) {
                error(e);
            }
        }
    }
}

//export as node module
if (typeof module !== 'undefined' && module.exports) {
    module.exports = pointsLayer;
}
// ...or as browser global
else {
    global.pointsLayer = pointsLayer;
}
