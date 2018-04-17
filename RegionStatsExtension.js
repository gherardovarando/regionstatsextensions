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

const path = require('path')
const {
  dialog
} = require('electron').remote
const {
  GuiExtension,
  util,
  ProgressBar,
  Modal,
  input,
  ToggleElement,
  Sidebar
} = require('electrongui')
const fs = require('fs')
require('leaflet-csvtiles')
const {
  area,
  inside,
  isRegion
} = require('./src/geometry.js')
const reg = ['polygon', 'rectangle', 'circle']
require('leaflet-tilelayer-colorpicker')

class RegionStatsExtension extends GuiExtension {

  constructor(gui) {
    if (Papa) Papa.SCRIPT_PATH = require.resolve('papaparse') //to be sure
    super(gui, {
      menuLabel: 'Region Stats',
      menuTemplate: [{
        label: 'Set statistics',
        click: () => {
          this.setStats()
        }
      }, {
        label: 'Auto stats',
        type: 'checkbox',
        click: (item) => {
          if (item.checked) {
            this.computeOnCreation()
            this.gui.alerts.add('Statistics will now be computed on creation', 'success')
          } else {
            this.computeOffCreation()
          }
        }
      }, {
        label: 'Add to details',
        type: 'checkbox',
        click: (item) => {
          this._options.details = item.checked
        }
      }, {
        label: 'Stats for selected regions',
        click: () => {
          this.stats()
        }
      },{
      label: 'Export points to csv',
      click: () =>{
        this.exportToCsv()
      }
    }]
    })
    this._options = {}
  }


  activate() {
    if (this._checkMapExtension()) {
      this.appendMenu()
      this.configuration = this.gui.extensions.extensions.MapExtension.activeConfiguration
      this.MapExtension = this.gui.extensions.extensions.MapExtension
      this.layersControl = this.gui.extensions.extensions.MapExtension.layersControl
      super.activate()
    }
  }

  deactivate() {
    super.deactivate()
  }

  setStats() {
    let body = util.div('pane pane-group')
    let sidebar = new Sidebar(body, {
      className: 'pane-sm scrollable'
    })
    let points = new ToggleElement(util.div('pane padded'))
    let calibration = new ToggleElement(util.div('pane padded'))
    let calInfo = new ToggleElement(util.div('pane padded'))
    calInfo.appendTo(calibration)
    calibration.hide()
    points.appendTo(body)
    calibration.appendTo(body)
    let hideAll = function() {
      points.hide()
      calibration.hide()
      sidebar.list.deactiveAll()
    }
    sidebar.addList()
    sidebar.addItem({
      id: 'points',
      title: 'points',
      toggle: true,
      active: true,
      onclick: () => {
        hideAll()
        points.show()
        sidebar.list.activeItem('points')
      }
    })
    sidebar.addItem({
      id: 'calibration',
      title: 'calibration',
      toggle: true,
      onclick: () => {
        hideAll()
        calibration.show()
        sidebar.list.activeItem('calibration')
      }
    })
    sidebar.addItem({
      id: 'export points',
      title: 'calibration',
      toggle: true,
      onclick: () => {
        hideAll()
        calibration.show()
        sidebar.list.activeItem('calibration')
      }
    })
    let configuration = this.MapExtension.activeConfiguration
    let nowCal
    if (configuration && configuration.layers) {
      let calibrations = {}
      Object.keys(configuration.layers).forEach((key) => {
        let layerConfig = configuration.layers[key]
        if (layerConfig.type === 'csvTiles') {
          if (layerConfig.role && layerConfig.role.includes && layerConfig.role.includes('points')) {
            var chk = true
          }
          input.input({
            type: 'checkbox',
            label: layerConfig.name,
            parent: points,
            className: 'form-control',
            checked: chk,
            onchange: (inp) => {
              if (inp.checked) {
                layerConfig.role = `${(layerConfig.role || '').replace('points','')}points`
              } else {
                layerConfig.role = (layerConfig.role || '').replace('points', '')
              }
            }
          })
        } else if (layerConfig.type === 'tileLayer') {
          calibrations[key] = layerConfig.name
        } else if (layerConfig.type === 'calibration') {
          calibrations[key] = layerConfig.name
        }

        if (layerConfig.role && layerConfig.role.includes && layerConfig.role.includes('calibration')) {
          nowCal = key
        }
      })
      input.selectInput({
        choices: calibrations,
        parent: calibration,
        className: 'form-control',
        label: 'Calibration layer',
        value: nowCal,
        oninput: (inp) => {
          Object.keys(calibrations).forEach((key) => {
            if (configuration.layers[key].role) {
              configuration.layers[key].role = configuration.layers[key].role.replace('calibration', '')
            }
          })
          configuration.layers[inp.value].role = `${configuration.layers[inp.value].role || ''}calibration`
          let cal = this.getCalibration()
          calInfo.clear()
          calInfo.appendChild(util.div('', `unit : ${cal.unit}`))
          calInfo.appendChild(util.div('', `dl : ${cal.dl}`))
          calInfo.appendChild(util.div('', `da : ${cal.da}`))
          calInfo.appendChild(util.div('', `dv : ${cal.dv}`))
        }
      })
    }


    let modal = new Modal({
      title: 'Set statistics',
      body: body,
      width: '500px'
    })

    modal.show()
  }

  stats() {
    if (!this.gui.extensions.extensions.MapExtension) return
    let regions = this.gui.extensions.extensions.MapExtension.layersControl.selectedRegions
    regions.map((reg) => {
      this.computeRegionStat(reg, true)
    })
  }

  _checkMapExtension() {
    if (!GuiExtension.is(this.gui.extensions.extensions.MapExtension)) {
      this.gui.alerts.add('MapExtension is not loaded, cant use RegionsStats', 'warning')
      return false
    }
    if (!this.gui.extensions.extensions.MapExtension.layersControl) {
      this.gui.alerts.add('MapExtension is not activated, cant use RegionsStats', 'warning')
      return false
    }
    return true
  }

  findRegionsToCompute() {
    let i = 0
    let regionsreturned = []
    //  if (!this.checkMap()) return
    let regions = this.gui.extensions.extensions.MapExtension.layersControl.selectedRegions
    regions.map((reg) => {
      if (isRegion(reg.configuration)) {
        regionsreturned.push(reg)
      }
    })
    return regionsreturned
  }

  // when a region is created on the map it computes the stats
  computeOnCreation() {
    let mapext = this.gui.extensions.extensions.MapExtension
    let builder = mapext.builder
    builder.on('load:layer', this.computeRegionStat, this)
  }

  computeOffCreation() {
    let mapext = this.gui.extensions.extensions.MapExtension
    let builder = mapext.builder
    builder.off('load:layer', this.computeRegionStat, this)
  }

  getCalibration() {
    let mapext = this.gui.extensions.extensions.MapExtension
    let active = mapext.activeConfiguration
    let layers = active.layers
    let c = {
      unit: 'u',
      dl: 1,
      da: 1,
      dv: 1
    }
    Object.keys(layers).forEach((id) => {
      if (layers[id].role && layers[id].role.includes && layers[id].role.includes('calibration')) {
        let sc = layers[id].options.sizeCal
        let dc = layers[id].options.depthCal
        let tileSize = layers[id].options.tileSize
        let size
        if (Array.isArray(tileSize)) {
          size = Math.max(...tileSize)
        } else if (tileSize > 0) {
          size = tileSize
        } else {
          size = 256 //default
        }
        let a = sc / size
        c = {
          unit: layers[id].options.unitCal || 'u',
          dl: a,
          da: a * a,
          dv: a * a * dc
        }
      }

    })
    return c
  }

  computeRegionStat(region, force) {
    if (!reg.includes(region.configuration.type)) return
    if (region.configuration.stats && !force) return
    let calibration = this.getCalibration()
    let conf = region.configuration
    let ps = []
    conf.stats = conf.stats || {}
    conf.stats.points = conf.stats.points || {}
    let a = area(conf)
    let unit = calibration.unit
    conf.stats.area = {
      raw: a,
      calibrated: {
        value: a * calibration.da,
        unit: `${unit || 'u'}^2`
      }
    }
    let dv = calibration.dv
    conf.stats.volume = {
      calibrated: {
        value: a * dv,
        unit: `${unit || 'u'}^3`
      }
    }
    conf.stats.densities = conf.stats.densities || {}
    ps.push(this.countPoints(region))

    Promise.all(ps).then(() => {
      this.completeStats(region)
      if (this._options.details) {
        region.configuration.details = this._generateDetails(region.configuration)
      }
      this.gui.alerts.add(`${region.configuration.name} stats completed`)
    })
  }

  _generateDetails(conf) {
    let stats = conf.stats
    let details = `<strong>Statistics: </strong>`
    details += `<p>Area: ${conf.stats.area.calibrated.value}  ${conf.stats.area.calibrated.unit}</p>`
    details += `<p>Volume : ${conf.stats.volume.calibrated.value}  ${conf.stats.volume.calibrated.unit}</p>`
    details += `<strong>Counts:</strong>`
    Object.keys(conf.stats.points).forEach((id) => {
      details += `<p>${conf.stats.points[id].name} : ${conf.stats.points[id].raw}</p>`
    })
    details += `<strong>Densities:</strong>`
    Object.keys(conf.stats.densities).forEach((id) => {
      details += `<p>area density ${conf.stats.points[id].name} : ${conf.stats.densities[id].area.calibrated.toPrecision(2)} ${conf.stats.densities[id].area.unit}</p>`
      details += `<p>volume density ${conf.stats.points[id].name} : ${conf.stats.densities[id].volume.calibrated.toPrecision(2)} ${conf.stats.densities[id].volume.unit}</p>`
    })
    details = details + ''
    return details
  }


  completeStats(region) {
    let pointsid = Object.keys(region.configuration.stats.points)
    pointsid.map((id) => {
      let n = region.configuration.stats.points[id].raw
      region.configuration.stats.densities[id] = {
        area: {
          raw: n / region.configuration.stats.area.raw,
          calibrated: n / region.configuration.stats.area.calibrated.value,
          unit: `points / ${region.configuration.stats.area.calibrated.unit}`
        },
        volume: {
          raw: n / region.configuration.stats.volume.raw,
          calibrated: n / region.configuration.stats.volume.calibrated.value,
          unit: `points / ${region.configuration.stats.volume.calibrated.unit}`
        }
      }
    })
  }

  /**
   * compute statistics for the given region
   * @param  {object} region object with properties layer, configuration, where
   * @param {boolena} worker use a worker when possible
   *
   * Will not return anything, results will be available in the configuration object (async)
   */
  countPoints(region) {
    let mapext = this.gui.extensions.extensions.MapExtension
    let active = mapext.activeConfiguration
    let layers = active.layers
    let points = []
    Object.keys(layers).map((id) => {
      if (layers[id].role && layers[id].role.includes && layers[id].role.includes('points')) points.push(id)
    })
    if (points.length == 0) return
    let ps = points.map((id) => {
      let conf = layers[id]
      if (conf.type.toLowerCase() === 'csvtiles') {
        let p = this.countCsvTiles(region, conf, false)
        let pp = p.then((result) => {
          region.configuration.stats.points[id] = {
            name: conf.name,
            raw: result.value,
            points: result.points
            //,references: result.references
          }
          return result.value
        })
        return pp
      }
    })
    return Promise.all(ps)
  }

  countCsvTiles(region, centroids, worker) {
    let mapext = this.gui.extensions.extensions.MapExtension
    let type = centroids.type
    let url = centroids.url
    let basepath = mapext.activeConfiguration.basePath
    let completepath = mapext.builder._joinBasePath(url)
    let csv = new L.CsvTiles(completepath, centroids.options)
    let references = csv.getReferences(region.layer.getBounds())
    let ps = references.map((ref) => {
      let pp = new Promise((res, rej) => {
        let m = 0
        let points = []
        csv.read(ref, (point) => {
          if (inside(point, region.configuration)) {
            points[m] = point
            m++
          }
        }, () => {
          res({
            value: m,
            points: points
          })
        }, () => {
          res({
            value: m,
            points: points
          })
        }, worker)
      })
      return pp
    })
    let p = Promise.all(ps)
    let pfinal = p.then((results) => {
      let values = results.map((res)=>{return res.value})
      let points = results.reduce((vect, obj)=>{return vect.concat(obj.points)}, [])
      return {
        value: util.sum(values),
        points: points
        //,references: references
      }
    })
    return pfinal
  }

}





module.exports = RegionStatsExtension
