/**
 * @author : gherardo varando (gherardo.varando@gmail.com) //carlos
 *
 * @license: MIT
 PEGAR


 */

'use strict'

const inside = require('point-in-polygon')
const path = require('path')
const {
  dialog
} = require('electron').remote
const {
  GuiExtension,
  util,
  ProgressBar
} = require('electrongui')
const fs = require('fs')
require('leaflet-csvtiles')

class RegionStatsExtension extends GuiExtension {

  constructor(gui) {
    Papa.SCRIPT_PATH = require.resolve('papaparse') //to be sure
    super(gui, {
      //  image: path.join(__dirname, "res", "img", "gm.png"), // not working
      menuLabel: 'RegionStats',
      menuTemplate: [{
        label: 'Show stats',
        click: () => {
          this.Stats()
        }
      }]
    })
  }


  activate() {
    if (this._checkMapExtension()) {
      this.appendMenu()
      super.activate()
    }
  }

  deactivate() {
    this.removeMenu()
    super.deactivate()
  }



  Stats() {
    let reg = []
    let point = []
    reg = this.findRegionsToCompute()

    this.findCsvTiles(reg);

    //point = this.findCsvTiles(reg);

    //pointinpolygon(point, polygon)
    //this.pointinpolygon(point, reg)

  }





  _checkMapExtension() {
    if (!GuiExtension.is(this.gui.extensions.extensions.MapExtension)) {
      this.gui.alerts.add('MapExtension is not loaded, cant use RegionsStats', 'warning')
    }
    console.log(this.gui.extensions.extensions.MapExtension)
    return GuiExtension.is(this.gui.extensions.extensions.MapExtension)
  }

  // checkActiveConf() { /// this is wrong ...
  //   if (!GuiExtension.is(this.gui.extensions.extensions.MapExtension.activeConfiguration))
  //     this.gui.alerts.add('No active configurations', 'warning')
  //   return GuiExtension.is(this.gui.extensions.extensions.MapExtension.activeConfiguration)
  // }


  findRegionsToCompute() {
    let i = 0
    let regionsreturned = []
    //  if (!this.checkMap()) return
    let regions = this.gui.extensions.extensions.MapExtension.layersControl.selectedRegions

    for (i = 0; i < regions.length; i++) {
      //console.log(i)
      if (regions[i].configuration.type == "rectangle") {
        regionsreturned.push(regions[i])
      } else if (regions[i].configuration.type == "polygon") {
        regionsreturned.push(regions[i])
      }
    }
    return regionsreturned
  }

  // when a region is created on the map it computes the stats
  computeOnCreation() { //just an example, it should be possible to enable/disable cumputing on creation
    let mapext = this.gui.extensions.extensions.MapExtension
    let builder = mapext.builder
    builder.on('load:layer', (e) => {
      if (e.configuration.type === 'polygon' || e.configuration.type === 'rectangle') this.findCsvTiles([e])
    })
  }


  /*encontrar los csvtiles*/
  // the name is wrong
  findCsvTiles(regions) {
    let i = 0
    let bounds = []
    let references = []
    let readpolygon = []

    //if (!this.checkActiveConf()) return

    //leafcsv = new L.CsvTiles(url, options) //vps136.cesvima.upm.es/maps/Hippocampus_vglut1/points/points_Hipocampo_HBP21_id4_corte_40_vGlut1_X0_Y0.tif.csv
    //let csv = new L.CsvTiles("vps136.cesvima.upm.es/maps/Hippocampus_vglut1/points/points_Hipocampo_HBP21_id4_corte_40_vGlut1_X0_Y0.tif.csv")
    //let csv = new L.CsvTiles("vps136.cesvima.upm.es/maps/Hippocampus_vglut1/points/points_Hipocampo_HBP21_id4_corte_40_vGlut1_X{X}_Y{Y}.tif.csv")
    //let csv = new L.CsvTiles("/home/cahernanz/Descargas/configuration.json")

    let mapext = this.gui.extensions.extensions.MapExtension
    let active = mapext.activeConfiguration
    let layers = active.layers
    let id = util.findKeyId('csvTiles', layers, 'type')
    let centroids = layers[id]
    let type = centroids.type
    let url = centroids.url
    let basepath = this.gui.extensions.extensions.MapExtension.activeConfiguration.basePath
    let completepath = mapext.builder._joinBasePath(url)
    //  console.log('completepath: ' + completepath)
    //
    centroids.options.worker = true
    let csv = new L.CsvTiles(completepath, centroids.options)
    this.csv = csv
    //let alert = this.gui.alerts.add('Counting ... ', '')
    let tot = 0
    let done = 0
    regions.map((reg) => {
      let item = mapext.layersControl.regionsWidget.items[reg.configuration._id]
      let pb = new ProgressBar(item)
      pb.setHeight(3)
      let references = csv.getReferences(reg.layer.getBounds())
      tot = tot + references.length
      let n = 0
      let m = 0
      references.map((ref) => {
        csv.read(ref, (point) => {
          //boolean = this.pointinpolygon(point, references)/////ok
          //  console.log("boolean: ", boolean)
          //console.log("boolean2: ", boolean2)
          let poly = (reg.configuration.latlngs[0]).map((a) => {
            return ([a.lng, a.lat])
          })
          if (inside([point.lng, point.lat], poly)) {
            m++
          }
        }, () => {
          n++
          done++
          //alert.setBodyText(`${(100 * done/tot).toPrecision(2)}%`)
          pb.setBar(100 * n / references.length)
          if (n === references.length) {
            pb.remove()
            this.gui.alerts.add(`${m} points in region ${reg.configuration.name}`)
          }
        }, () => {
          n++
          done++
          pb.setBar(100 * n / references.length)
          //alert.setBodyText(`${(100 * done/tot).toPrecision(2)}%`)
          if (n === references.length) {
            pb.remove()
            this.gui.alerts.add(`${m} points in region ${reg.configuration.name}`)
          }
        })
      }, false)

    })
  }






  //////////////////////////////////////////////////
  //////////////////////////////////////////////////
  /**
   * check if a given point is inside a polygon
   * @param  {array} point   2 dimensions vector
   * @param  {polygon} polygon vector of 2dim vectors components,
   * @return {logical}
   */
  pointinpolygon(point, polygon) {
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
  }

}



module.exports = RegionStatsExtension
