/**
 * @author : gherardo varando (gherardo.varando@gmail.com) //carlos
 *
 * @license: MenuItem
 PEGAR


 */

'use strict'

const inside = require('point-in-polygon');


const path = require('path')
const nativeImage = require('electron').nativeImage
const {
  dialog
} = require('electron').remote
const {
  SplitPane,
  Task,
  ButtonsContainer,
  GuiExtension,
  Grid,
  Modal,
  util
} = require('electrongui')
const TreeList = require('electrongui').TreeList.TreeList

const fs = require('fs');

//const RegionAnalyzer = require('./_modules/RegionAnalyzer.js');


const leafcsv = require('leaflet-csvtiles')

class RegionStatsExtension extends GuiExtension {

  constructor(gui) {
    super(gui, {
      image: path.join(__dirname, "res", "img", "gm.png"), // not working
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
    this.appendMenu()
  }

  deactivate() {
    util.empty(this.element, this.element.firstChild)
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





  checkMap() {
    if (!GuiExtension.is(this.gui.extensions.extensions.MapExtension))
      this.gui.alerts.add('MapExtension is not loaded', 'warning')
    return GuiExtension.is(this.gui.extensions.extensions.MapExtension)
  }

  checkActiveConf() {
    if (!GuiExtension.is(this.gui.extensions.extensions.MapExtension.activeConfiguration))
      this.gui.alerts.add('No active configurations', 'warning')
    return GuiExtension.is(this.gui.extensions.extensions.MapExtension.activeConfiguration)
  }


  findRegionsToCompute() {
    let i = 0
    let regionsreturned = []
    //  if (!this.checkMap()) return
    let regions = this.gui.extensions.extensions.MapExtension.layersControl.selectedRegions
    console.log('regions: ', regions)
    console.log('size of regions array: ', regions.length)

    for (i = 0; i < regions.length; i++) {
      //console.log(i)
      if (regions[i].configuration.type == "rectangle") {
        regionsreturned.push(regions[i])
        console.log("\n\n Rectangle \n\n") //push a vector
      } else if (regions[i].configuration.type == "polygon") {
        regionsreturned.push(regions[i])
        console.log("\n\n Polygon \n\n") /*contar puntos*/
      }
    }
    console.log('regionsreturned: ', regionsreturned)
    return regionsreturned
  }


  /*encontrar los csvtiles*/
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
    console.log('ttttttttttttttttttttttt')
    //let csv = new L.CsvTiles("http://vps136.cesvima.upm.es/maps/Hippocampus_vglut1/points/points_Hipocampo_HBP21_id4_corte_40_vGlut1_X{x}_Y{y}.tif.csv")
    let csv = new L.CsvTiles("http://vps136.cesvima.upm.es/maps/Hippocampus_vglut1/points/points_Hipocampo_HBP21_id4_corte_40_vGlut1_X0_Y0.tif.csv", {
      //let csv = new L.CsvTiles("http://vps136.cesvima.upm.es/maps/Hippocampus_vgat/vGat_map_all_tiles/0/0/1.png")

      "tileSize": [
        1024,
        1024
      ],
      "size": [
        45056,
        28672
      ],
      "bounds": [
        [-162.90909090904,
          0
        ],
        [
          0,
          256
        ]
      ],
      "encoding": "utf8",
      "localRS": true,
      "minZoom": 6,
      "color": "red",
      "radius": 4,
      "fillColor": "red"
    })
    //deberiamos construir la url
    console.log('CSV: ', csv)
    console.log('ttttttttttttttttttttttfffffffffft2222222')

    let layer = gui.extensions.extensions.MapExtension.activeConfiguration.layers
    let centroids = gui.extensions.extensions.MapExtension.activeConfiguration.layers.centroids_vGlut1

    let type = centroids.type
    let url = centroids.url
    let basepath = gui.extensions.extensions.MapExtension.activeConfiguration.basePath
    let completepath = basepath + url
    let boolean
        let boolean2
    //  console.log('completepath: ' + completepath)

    regions.map((reg) => {
      let references = csv._getReferences(reg.layer.getBounds())
      let n = 0
      let m = 0
      references.map((references) => {
        csv._read(references, (point) => {
          n++
          console.log("N: ", n)
          console.log("Point: ", point)

          //boolean = this.pointinpolygon(point, references)/////ok
          boolean = inside(point, references)
          console.log("boolean: ", boolean)
                    //console.log("boolean2: ", boolean2)
          if (boolean == true) {
            m++
            console.log("m: ", m)
          }
          console.log("m2: ", m)
        })
        console.log("N total: ", n)
      })
      console.log("N total2: ", n)

    })

    // for (i = 0; i < regions.length; i++) {
    //
    //   bounds[i] = gui.extensions.extensions.MapExtension.layersControl.selectedRegions[i].layer.getBounds()
    //   console.log('bounds: ',  bounds[i])
    //   references[i] = csv._getReferences(bounds[i])
    //   //references[i] =  bounds[i]._getReferences
    //   console.log('references: ' , references[i]) //_getReferences
    //   readpolygon[i] = csv._read(references[i][0])
    //   console.log('readpolygon: ' , readpolygon[i]) //_getReferences
    //
    //
    //
    // }

  } //activeConfiguration. layers

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
    console.log("Inside: ", inside)
  }
  ///////////////////////////////////////////////////
  ///////////////////////////////////////////////////







}
///////////////////////////////////////////////////

class PointsCounting extends Task {

  constructor(polygon, points, size) {
    let name = `Points counting`;
    let details = `Counting in ${polygon._configuration.name} using ${points.name}`;
    let scale = points.size / size;
    super(name, details, gui);
    this.polygon = extractPolygonArray(polygon.getLatLngs(), scale);
    this.points = points;
  }

  run(callback) {
    super.run();
    let pol = this.polygon;
    let ch = fork(`${__dirname}/childCount.js`);
    ch.on('message', (m) => {
      switch (m.x) {
        case 'complete':
          if (typeof callback === 'function') callback(m);
          ch.kill();
          this.success();
          break;
        case 'step':
          this.updateProgress((m.prog / m.tot) * 100);
          break;
        case 'error':
          this.fail(m.error + "error");
          ch.kill();
          break;
        default:
          null
      }
    });
    ch.send({
      job: 'points',
      polygon: pol,
      points: this.points
    });
    this.childProcess = ch;
  }

  cancel() {
    if (super.cancel()) {
      if (this.childProcess instanceof ChildProcess) {
        this.childProcess.kill();
      }
      return true;
    }
    return false;
  }
}

////////////////////////////////////////////////////


module.exports = RegionStatsExtension
