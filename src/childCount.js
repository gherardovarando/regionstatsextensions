const pointsLayer = require(`./pointsLayer.js`);

process.on('message', (m) => {
    let points = new pointsLayer(m.points);
    points.countPoints({
        polygon: m.polygon,
        complete: (r) => {
            r.x = 'complete';
            process.send(r);
        },
        error: (e) => {
            e.x = 'error'
            process.send(e);
        },
        bunch: (s,t) =>{
           let step = {x:'step',prog:s,tot:t};
           process.send(step);
        }
    });
});
