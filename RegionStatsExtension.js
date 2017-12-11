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
  input
} = require('electrongui')
const fs = require('fs')
require('leaflet-csvtiles')
const {
  area,
  inside,
  isRegion
} = require('./src/geometry.js')
const reg = ['polygon', 'rectangle', 'circle']


class RegionStatsExtension extends GuiExtension {

  constructor(gui) {
    if (Papa) Papa.SCRIPT_PATH = require.resolve('papaparse') //to be sure
    super(gui, {
      menuLabel: 'Region Stats',
      menuTemplate: [{
        label: 'Set statistics',
        click: () => {
          //this.setStats()
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
      }]
    })
    this._options = {}
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

  setStats() {
    if (this.modal) {
      this.modal.show()
    } else {
      let body = util.div('pane padded')
      input.input({
        parent: body,
        type: 'checkbox',
        label: 'Add to details',
        className: 'form-control',
        onclick: (inp) => {
          this._options.details = inp.checked
        }
      })
      this.modal = new Modal({
        title: 'Set statistics',
        body: body,
        permanent: true,
        onsubmit: () => {
          this.modal.hide()
        },
        oncancel: () => {
          this.modal.hide()
        }
      })
      this.modal.show()
    }
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
    }
    return GuiExtension.is(this.gui.extensions.extensions.MapExtension)
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
    let details = `<p>Statistics: </p>`
    details += `<p>Area: ${conf.stats.area.calibrated.value}  ${conf.stats.area.calibrated.unit}</p>`
    details += `<p>Volume : ${conf.stats.area.calibrated.value}  ${conf.stats.volume.calibrated.unit}</p>`
    Object.keys(conf.stats.points).forEach((id) => {
      details += `<p>${conf.stats.points[id].name} : ${conf.stats.points[id].raw}</p>`
    })
    Object.keys(conf.stats.densities).forEach((id) => {
      details += `<p>${conf.stats.points[id].name} : ${conf.stats.densities[id].calibrated.toPrecision(2)} ${conf.stats.densities[id].unit}</p>`
    })
    details = details + ''
    return details
  }


  completeStats(region) {
    let pointsid = Object.keys(region.configuration.stats.points)
    pointsid.map((id) => {
      let n = region.configuration.stats.points[id].raw
      region.configuration.stats.densities[id] = {
        raw: n / region.configuration.stats.area.raw,
        calibrated: n / region.configuration.stats.area.calibrated.value,
        unit: `points / ${region.configuration.stats.area.calibrated.unit}`
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
        let pp = p.then((n) => {
          region.configuration.stats.points[id] = {
            name: conf.name,
            raw: n
          }
          return n
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
        csv.read(ref, (point) => {
          if (inside(point, region.configuration)) {
            m++
          }
        }, () => {
          res(m)
        }, () => {
          res(m)
        }, worker)
      })
      return pp
    })
    let p = Promise.all(ps)
    let pfinal = p.then((value) => {
      return util.sum(value)
    })
    return pfinal
  }


}





module.exports = RegionStatsExtension
