var Plotly = require('@lib/index');
var Lib = require('@src/lib');

var d3 = require('d3');
var createGraphDiv = require('../assets/create_graph_div');
var destroyGraphDiv = require('../assets/destroy_graph_div');
var failTest = require('../assets/fail_test');
var click = require('../assets/click');
var getClientPosition = require('../assets/get_client_position');
var mouseEvent = require('../assets/mouse_event');
var supplyAllDefaults = require('../assets/supply_defaults');
var rgb = require('../../../src/components/color').rgb;

var customAssertions = require('../assets/custom_assertions');
var assertHoverLabelStyle = customAssertions.assertHoverLabelStyle;
var assertHoverLabelContent = customAssertions.assertHoverLabelContent;
var checkTextTemplate = require('../assets/check_texttemplate');

var SLICES_SELECTOR = '.slice path';
var SLICES_TEXT_SELECTOR = '.pielayer text.slicetext';
var LEGEND_ENTRIES_SELECTOR = '.legendpoints path';

describe('Pie defaults', function() {
    function _supply(trace, layout) {
        var gd = {
            data: [trace],
            layout: layout || {}
        };

        supplyAllDefaults(gd);

        return gd._fullData[0];
    }

    it('finds the minimum length of labels & values', function() {
        var out = _supply({type: 'pie', labels: ['A', 'B'], values: [1, 2, 3]});
        expect(out._length).toBe(2);

        out = _supply({type: 'pie', labels: ['A', 'B', 'C'], values: [1, 2]});
        expect(out._length).toBe(2);
    });

    it('allows labels or values to be missing but not both', function() {
        var out = _supply({type: 'pie', values: [1, 2]});
        expect(out.visible).toBe(true);
        expect(out._length).toBe(2);
        expect(out.label0).toBe(0);
        expect(out.dlabel).toBe(1);

        out = _supply({type: 'pie', labels: ['A', 'B']});
        expect(out.visible).toBe(true);
        expect(out._length).toBe(2);

        out = _supply({type: 'pie'});
        expect(out.visible).toBe(false);
    });

    it('is marked invisible if either labels or values is empty', function() {
        var out = _supply({type: 'pie', labels: [], values: [1, 2]});
        expect(out.visible).toBe(false);

        out = _supply({type: 'pie', labels: ['A', 'B'], values: []});
        expect(out.visible).toBe(false);
    });

    it('does not apply layout.font.color to insidetextfont.color (it\'ll be contrasting instead)', function() {
        var out = _supply({type: 'pie', values: [1, 2]}, {font: {color: 'blue'}});
        expect(out.insidetextfont.color).toBe(undefined);
    });

    it('does apply textfont.color to insidetextfont.color if not set', function() {
        var out = _supply({type: 'pie', values: [1, 2], textfont: {color: 'blue'}}, {font: {color: 'red'}});
        expect(out.insidetextfont.color).toBe('blue');
    });
});

describe('Pie traces', function() {
    'use strict';

    var DARK = '#444';
    var LIGHT = '#fff';

    var gd;

    beforeEach(function() { gd = createGraphDiv(); });

    afterEach(destroyGraphDiv);

    it('should separate colors and opacities', function(done) {
        Plotly.newPlot(gd, [{
            values: [1, 2, 3, 4, 5],
            type: 'pie',
            sort: false,
            marker: {
                line: {width: 3, color: 'rgba(100,100,100,0.7)'},
                colors: [
                    'rgba(0,0,0,0.2)',
                    'rgba(255,0,0,0.3)',
                    'rgba(0,255,0,0.4)',
                    'rgba(0,0,255,0.5)',
                    'rgba(255,255,0,0.6)'
                ]
            }
        }], {height: 300, width: 400}).then(function() {
            var colors = [
                'rgb(0,0,0)',
                'rgb(255,0,0)',
                'rgb(0,255,0)',
                'rgb(0,0,255)',
                'rgb(255,255,0)'
            ];
            var opacities = [0.2, 0.3, 0.4, 0.5, 0.6];

            function checkPath(d, i) {
                // strip spaces (ie 'rgb(0, 0, 0)') so we're not dependent on browser specifics
                expect(this.style.fill.replace(/\s/g, '')).toBe(colors[i]);
                expect(this.style.fillOpacity).toBe(String(opacities[i]));
                expect(this.style.stroke.replace(/\s/g, '')).toBe('rgb(100,100,100)');
                expect(this.style.strokeOpacity).toBe('0.7');
            }
            var slices = d3.selectAll(SLICES_SELECTOR);
            slices.each(checkPath);
            expect(slices.size()).toBe(5);

            var legendEntries = d3.selectAll(LEGEND_ENTRIES_SELECTOR);
            legendEntries.each(checkPath);
            expect(legendEntries.size()).toBe(5);
        })
        .catch(failTest)
        .then(done);
    });

    it('can sum values or count labels', function(done) {
        Plotly.newPlot(gd, [{
            labels: ['a', 'b', 'c', 'a', 'b', 'a'],
            values: [1, 2, 3, 4, 5, 6],
            type: 'pie',
            domain: {x: [0, 0.45]}
        }, {
            labels: ['d', 'e', 'f', 'd', 'e', 'd'],
            type: 'pie',
            domain: {x: [0.55, 1]}
        }])
        .then(function() {
            var expected = [
                [['a', 11], ['b', 7], ['c', 3]],
                [['d', 3], ['e', 2], ['f', 1]]
            ];
            for(var i = 0; i < 2; i++) {
                for(var j = 0; j < 3; j++) {
                    expect(gd.calcdata[i][j].label).toBe(expected[i][j][0], i + ',' + j);
                    expect(gd.calcdata[i][j].v).toBe(expected[i][j][1], i + ',' + j);
                }
            }
        })
        .catch(failTest)
        .then(done);
    });

    function _checkSliceColors(colors) {
        return function() {
            d3.select(gd).selectAll(SLICES_SELECTOR).each(function(d, i) {
                expect(this.style.fill.replace(/(\s|rgb\(|\))/g, '')).toBe(colors[i], i);
            });
        };
    }

    function _checkFontColors(expFontColors) {
        return function() {
            d3.selectAll(SLICES_TEXT_SELECTOR).each(function(d, i) {
                expect(this.style.fill).toBe(rgb(expFontColors[i]), 'fill color of ' + i);
            });
        };
    }

    function _checkFontFamilies(expFontFamilies) {
        return function() {
            d3.selectAll(SLICES_TEXT_SELECTOR).each(function(d, i) {
                expect(this.style.fontFamily).toBe(expFontFamilies[i], 'fontFamily of ' + i);
            });
        };
    }

    function _checkFontSizes(expFontSizes) {
        return function() {
            d3.selectAll(SLICES_TEXT_SELECTOR).each(function(d, i) {
                expect(this.style.fontSize).toBe(expFontSizes[i] + 'px', 'fontSize of ' + i);
            });
        };
    }

    it('propagate explicit colors to the same labels in earlier OR later traces', function(done) {
        var data1 = [
            {type: 'pie', values: [3, 2], marker: {colors: ['red', 'black']}, domain: {x: [0.5, 1]}},
            {type: 'pie', values: [2, 5], domain: {x: [0, 0.5]}}
        ];
        var data2 = Lib.extendDeep([], [data1[1], data1[0]]);

        Plotly.newPlot(gd, data1)
        .then(_checkSliceColors(['255,0,0', '0,0,0', '0,0,0', '255,0,0']))
        .then(function() {
            return Plotly.newPlot(gd, data2);
        })
        .then(_checkSliceColors(['0,0,0', '255,0,0', '255,0,0', '0,0,0']))
        .catch(failTest)
        .then(done);
    });

    it('can use a separate pie colorway and disable extended colors', function(done) {
        Plotly.newPlot(gd, [{type: 'pie', values: [7, 6, 5, 4, 3, 2, 1]}], {colorway: ['#777', '#F00']})
        .then(_checkSliceColors(['119,119,119', '255,0,0', '170,170,170', '255,102,102', '68,68,68', '153,0,0', '119,119,119']))
        .then(function() {
            return Plotly.relayout(gd, {extendpiecolors: false});
        })
        .then(_checkSliceColors(['119,119,119', '255,0,0', '119,119,119', '255,0,0', '119,119,119', '255,0,0', '119,119,119']))
        .then(function() {
            return Plotly.relayout(gd, {piecolorway: ['#FF0', '#0F0', '#00F']});
        })
        .then(_checkSliceColors(['255,255,0', '0,255,0', '0,0,255', '255,255,0', '0,255,0', '0,0,255', '255,255,0']))
        .then(function() {
            return Plotly.relayout(gd, {extendpiecolors: null});
        })
        .then(_checkSliceColors(['255,255,0', '0,255,0', '0,0,255', '255,255,102', '102,255,102', '102,102,255', '153,153,0']))
        .catch(failTest)
        .then(done);
    });

    it('shows multiline title in hole', function(done) {
        Plotly.newPlot(gd, [{
            values: [2, 2, 2, 2],
            title: 'Test<br>Title',
            hole: 0.5,
            type: 'pie',
            textinfo: 'none'
        }], {height: 300, width: 300})
        .then(function() {
            var title = d3.selectAll('.titletext text');
            expect(title.size()).toBe(1);
            var titlePos = getClientPosition('g.titletext');
            var pieCenterPos = getClientPosition('g.trace');
            expect(Math.abs(titlePos[0] - pieCenterPos[0])).toBeLessThan(4);
            expect(Math.abs(titlePos[1] - pieCenterPos[1])).toBeLessThan(4);
        })
        .catch(failTest)
        .then(done);
    });

    function _verifyPointInCircle(x, y, circleCenter, radius) {
        var dist = Math.pow(x - circleCenter[0], 2) + Math.pow(y - circleCenter[1], 2);
        return Math.abs(Math.sqrt(dist) - radius);
    }

    it('scales multiline title to fit in hole', function(done) {
        Plotly.newPlot(gd, [{
            values: [2, 2, 2, 2],
            title: 'Test<br>Title',
            titleposition: 'middle center',
            titlefont: {
                size: 60
            },
            hole: 0.1,
            type: 'pie',
            textinfo: 'none'
        }], {height: 300, width: 300})
        .then(function() {
            var title = d3.selectAll('.titletext text');
            expect(title.size()).toBe(1);
            var titleBox = d3.select('g.titletext').node().getBoundingClientRect();
            var pieBox = d3.select('g.trace').node().getBoundingClientRect();
            var radius = 0.1 * Math.min(pieBox.width / 2, pieBox.height / 2);
            var pieCenterPos = getClientPosition('g.trace');
            // unfortunately boundingClientRect is inaccurate and so we allow an error of 3
            expect(_verifyPointInCircle(titleBox.left, titleBox.top, pieCenterPos, radius))
                .toBeLessThan(3);
            expect(_verifyPointInCircle(titleBox.right, titleBox.top, pieCenterPos, radius))
                .toBeLessThan(3);
            expect(_verifyPointInCircle(titleBox.left, titleBox.bottom, pieCenterPos, radius))
                .toBeLessThan(3);
            expect(_verifyPointInCircle(titleBox.right, titleBox.bottom, pieCenterPos, radius))
                .toBeLessThan(3);
        })
        .catch(failTest)
        .then(done);
    });

    function _verifyTitle(checkLeft, checkRight, checkTop, checkBottom, checkMiddleX) {
        return function() {
            var title = d3.selectAll('.titletext text');
            expect(title.size()).toBe(1);
            var titleBox = d3.select('g.titletext').node().getBoundingClientRect();
            var pieBox = d3.select('g.trace').node().getBoundingClientRect();
            // check that margins agree. we leave an error margin of 2.
            if(checkLeft) expect(Math.abs(titleBox.left - pieBox.left)).toBeLessThan(2);
            if(checkRight) expect(Math.abs(titleBox.right - pieBox.right)).toBeLessThan(2);
            if(checkTop) expect(Math.abs(titleBox.top - pieBox.top)).toBeLessThan(2);
            if(checkBottom) expect(Math.abs(titleBox.bottom - pieBox.bottom)).toBeLessThan(2);
            if(checkMiddleX) {
                expect(Math.abs(titleBox.left + titleBox.right - pieBox.left - pieBox.right))
                    .toBeLessThan(2);
            }
        };
    }

    it('shows title top center if hole is zero', function(done) {
        Plotly.newPlot(gd, [{
            values: [2, 2, 2, 2],
            title: 'Test<BR>Title',
            titleposition: 'middle center',
            titlefont: {
                size: 12
            },
            hole: 0,
            type: 'pie',
            textinfo: 'none'
        }], {height: 300, width: 300})
        .then(_verifyTitle(false, false, true, false, true))
        .catch(failTest)
        .then(done);
    });

    it('shows title top center if titleposition is undefined and no hole', function(done) {
        Plotly.newPlot(gd, [{
            values: [2, 2, 2, 2],
            title: 'Test<BR>Title',
            titlefont: {
                size: 12
            },
            type: 'pie',
            textinfo: 'none'
        }], {height: 300, width: 300})
        .then(_verifyTitle(false, false, true, false, true))
        .catch(failTest)
        .then(done);
    });

    it('shows title top center', function(done) {
        Plotly.newPlot(gd, [{
            values: [1, 1, 1, 1, 2],
            title: 'Test<BR>Title',
            titleposition: 'top center',
            titlefont: {
                size: 12
            },
            type: 'pie',
            textinfo: 'none'
        }], {height: 300, width: 300})
        .then(_verifyTitle(false, false, true, false, true))
        .catch(failTest)
        .then(done);
    });

    it('shows title top left', function(done) {
        Plotly.newPlot(gd, [{
            values: [3, 2, 1],
            title: 'Test<BR>Title',
            titleposition: 'top left',
            titlefont: {
                size: 12
            },
            type: 'pie',
            textinfo: 'none'
        }], {height: 300, width: 300})
        .then(_verifyTitle(true, false, true, false, false))
        .catch(failTest)
        .then(done);
    });

    it('shows title top right', function(done) {
        Plotly.newPlot(gd, [{
            values: [4, 5, 6, 5],
            title: 'Test<BR>Title',
            titleposition: 'top right',
            titlefont: {
                size: 12
            },
            type: 'pie',
            textinfo: 'none'
        }], {height: 300, width: 300})
        .then(_verifyTitle(false, true, true, false, false))
        .catch(failTest)
        .then(done);
    });

    it('shows title bottom left', function(done) {
        Plotly.newPlot(gd, [{
            values: [4, 5, 6, 5],
            title: 'Test<BR>Title',
            titleposition: 'bottom left',
            titlefont: {
                size: 12
            },
            type: 'pie',
            textinfo: 'none'
        }], {height: 300, width: 300})
        .then(_verifyTitle(true, false, false, true, false))
        .catch(failTest)
        .then(done);
    });

    it('shows title bottom center', function(done) {
        Plotly.newPlot(gd, [{
            values: [4, 5, 6, 5],
            title: 'Test<BR>Title',
            titleposition: 'bottom center',
            titlefont: {
                size: 12
            },
            type: 'pie',
            textinfo: 'none'
        }], {height: 300, width: 300})
        .then(_verifyTitle(false, false, false, true, true))
        .catch(failTest)
        .then(done);
    });

    it('shows title bottom right', function(done) {
        Plotly.newPlot(gd, [{
            values: [4, 5, 6, 5],
            title: 'Test<BR>Title',
            titleposition: 'bottom right',
            titlefont: {
                size: 12
            },
            type: 'pie',
            textinfo: 'none'
        }], {height: 300, width: 300})
        .then(_verifyTitle(false, true, false, true, false))
        .catch(failTest)
        .then(done);
    });

    it('should be able to restyle title position', function(done) {
        Plotly.newPlot(gd, [{
            values: [3, 2, 1],
            title: 'Test<BR>Title',
            titleposition: 'top left',
            titlefont: {
                size: 12
            },
            type: 'pie',
            textinfo: 'none'
        }], {height: 300, width: 300})
        .then(_verifyTitle(true, false, true, false, false))
        .then(function() { return Plotly.restyle(gd, 'titleposition', 'top right'); })
        .then(_verifyTitle(false, true, true, false, false))
        .then(function() { return Plotly.restyle(gd, 'titleposition', 'bottom left'); })
        .then(_verifyTitle(true, false, false, true, false))
        .then(function() { return Plotly.restyle(gd, 'titleposition', 'bottom center'); })
        .then(_verifyTitle(false, false, false, true, true))
        .then(function() { return Plotly.restyle(gd, 'titleposition', 'bottom right'); })
        .then(_verifyTitle(false, true, false, true, false))
        .catch(failTest)
        .then(done);
    });

    it('does not intersect pulled slices', function(done) {
        Plotly.newPlot(gd, [{
            values: [2, 2, 2, 2],
            title: 'Test<BR>Title',
            titleposition: 'top center',
            titlefont: {
                size: 14
            },
            pull: [0.9, 0.9, 0.9, 0.9],
            type: 'pie',
            textinfo: 'none'
        }], {height: 300, width: 300})
        .then(function() {
            var title = d3.selectAll('.titletext text');
            expect(title.size()).toBe(1);
            var titleBox = d3.select('g.titletext').node().getBoundingClientRect();
            var minSliceTop = Infinity;
            d3.selectAll('g.slice').each(function() {
                var sliceTop = d3.select(this).node().getBoundingClientRect().top;
                minSliceTop = Math.min(minSliceTop, sliceTop);
            });
            expect(titleBox.bottom).toBeLessThan(minSliceTop);
        })
        .catch(failTest)
        .then(done);
    });

    it('correctly positions large title', function(done) {
        Plotly.newPlot(gd, [{
            values: [1, 3, 4, 1, 2],
            title: 'Test<BR>Title',
            titleposition: 'top center',
            titlefont: {
                size: 60
            },
            type: 'pie',
            textinfo: 'none'
        }], {height: 300, width: 300})
        .then(_verifyTitle(false, false, true, false, true))
        .catch(failTest)
        .then(done);
    });

    it('support separate stroke width values per slice', function(done) {
        var data = [
            {
                values: [20, 26, 55],
                labels: ['Residential', 'Non-Residential', 'Utility'],
                type: 'pie',
                pull: [0.1, 0, 0],
                marker: {
                    colors: ['rebeccapurple', 'purple', 'mediumpurple'],
                    line: {
                        width: [3, 0, 0]
                    }
                }
            }
        ];
        var layout = {
            showlegend: true
        };

        Plotly.plot(gd, data, layout)
          .then(function() {
              var expWidths = ['3', '0', '0'];

              d3.selectAll(SLICES_SELECTOR).each(function(d, i) {
                  expect(this.style.strokeWidth).toBe(expWidths[d.pointNumber], 'sector #' + i);
              });
              d3.selectAll(LEGEND_ENTRIES_SELECTOR).each(function(d, i) {
                  expect(this.style.strokeWidth).toBe(expWidths[d[0].i], 'item #' + i);
              });
          })
          .catch(failTest)
          .then(done);
    });

    [
        {fontAttr: 'textfont', textposition: 'outside'},
        {fontAttr: 'textfont', textposition: 'inside'},
        {fontAttr: 'outsidetextfont', textposition: 'outside'},
        {fontAttr: 'insidetextfont', textposition: 'inside'}
    ].forEach(function(spec) {
        var desc = 'allow to specify ' + spec.fontAttr +
          ' properties per individual slice (textposition ' + spec.textposition + ')';
        it(desc, function(done) {
            var data = {
                values: [3, 2, 1],
                type: 'pie',
                textposition: spec.textposition
            };
            data[spec.fontAttr] = {
                color: ['red', 'green', 'blue'],
                family: ['Arial', 'Gravitas', 'Roboto'],
                size: [12, 20, 16]
            };

            Plotly.plot(gd, [data])
              .then(_checkFontColors(['red', 'green', 'blue']))
              .then(_checkFontFamilies(['Arial', 'Gravitas', 'Roboto']))
              .then(_checkFontSizes([12, 20, 16]))
              .catch(failTest)
              .then(done);
        });
    });

    var insideTextTestsTrace = {
        values: [6, 5, 4, 3, 2, 1],
        type: 'pie',
        marker: {
            colors: ['#ee1', '#eee', '#333', '#9467bd', '#dda', '#922'],
        }
    };

    it('should use inside text colors contrasting to explicitly set slice colors by default', function(done) {
        Plotly.plot(gd, [insideTextTestsTrace])
          .then(_checkFontColors([DARK, DARK, LIGHT, LIGHT, DARK, LIGHT]))
          .catch(failTest)
          .then(done);
    });

    it('should use inside text colors contrasting to standard slice colors by default', function(done) {
        var noMarkerTrace = Lib.extendFlat({}, insideTextTestsTrace);
        delete noMarkerTrace.marker;

        Plotly.plot(gd, [noMarkerTrace])
          .then(_checkFontColors([LIGHT, DARK, LIGHT, LIGHT, LIGHT, LIGHT]))
          .catch(failTest)
          .then(done);
    });

    it('should use textfont.color for inside text instead of the contrasting default', function(done) {
        var data = Lib.extendFlat({}, insideTextTestsTrace, {textfont: {color: 'red'}});
        Plotly.plot(gd, [data])
          .then(_checkFontColors(Lib.repeat('red', 6)))
          .catch(failTest)
          .then(done);
    });

    it('should use matching color from textfont.color array for inside text, contrasting otherwise', function(done) {
        var data = Lib.extendFlat({}, insideTextTestsTrace, {textfont: {color: ['red', 'blue']}});
        Plotly.plot(gd, [data])
          .then(_checkFontColors(['red', 'blue', LIGHT, LIGHT, DARK, LIGHT]))
          .catch(failTest)
          .then(done);
    });

    it('should not use layout.font.color for inside text, but a contrasting color instead', function(done) {
        Plotly.plot(gd, [insideTextTestsTrace], {font: {color: 'green'}})
          .then(_checkFontColors([DARK, DARK, LIGHT, LIGHT, DARK, LIGHT]))
          .catch(failTest)
          .then(done);
    });

    it('should use matching color from insidetextfont.color array instead of the contrasting default', function(done) {
        var data = Lib.extendFlat({}, insideTextTestsTrace, {textfont: {color: ['orange', 'purple']}});
        Plotly.plot(gd, [data])
          .then(_checkFontColors(['orange', 'purple', LIGHT, LIGHT, DARK, LIGHT]))
          .catch(failTest)
          .then(done);
    });

    [
        {fontAttr: 'outsidetextfont', textposition: 'outside'},
        {fontAttr: 'insidetextfont', textposition: 'inside'}
    ].forEach(function(spec) {
        it('should fall back to textfont scalar values if ' + spec.fontAttr + ' value ' +
          'arrays don\'t cover all slices', function(done) {
            var data = Lib.extendFlat({}, insideTextTestsTrace, {
                textposition: spec.textposition,
                textfont: {color: 'orange', family: 'Gravitas', size: 12}
            });
            data[spec.fontAttr] = {color: ['blue', 'yellow'], family: ['Arial', 'Arial'], size: [24, 34]};

            Plotly.plot(gd, [data])
              .then(_checkFontColors(['blue', 'yellow', 'orange', 'orange', 'orange', 'orange']))
              .then(_checkFontFamilies(['Arial', 'Arial', 'Gravitas', 'Gravitas', 'Gravitas', 'Gravitas']))
              .then(_checkFontSizes([24, 34, 12, 12, 12, 12]))
              .catch(failTest)
              .then(done);
        });
    });

    it('should fall back to textfont array values and layout.font scalar (except color)' +
      ' values for inside text', function(done) {
        var layout = {font: {color: 'orange', family: 'serif', size: 16}};
        var data = Lib.extendFlat({}, insideTextTestsTrace, {
            textfont: {
                color: ['blue', 'blue'], family: ['Arial', 'Arial'], size: [18, 18]
            },
            insidetextfont: {
                color: ['purple'], family: ['Roboto'], size: [24]
            }
        });

        Plotly.plot(gd, [data], layout)
          .then(_checkFontColors(['purple', 'blue', LIGHT, LIGHT, DARK, LIGHT]))
          .then(_checkFontFamilies(['Roboto', 'Arial', 'serif', 'serif', 'serif', 'serif']))
          .then(_checkFontSizes([24, 18, 16, 16, 16, 16]))
          .catch(failTest)
          .then(done);
    });

    it('should fall back to textfont array values and layout.font scalar' +
      ' values for outside text', function(done) {
        var layout = {font: {color: 'orange', family: 'serif', size: 16}};
        var data = Lib.extendFlat({}, insideTextTestsTrace, {
            textposition: 'outside',
            textfont: {
                color: ['blue', 'blue'], family: ['Arial', 'Arial'], size: [18, 18]
            },
            outsidetextfont: {
                color: ['purple'], family: ['Roboto'], size: [24]
            }
        });

        Plotly.plot(gd, [data], layout)
          .then(_checkFontColors(['purple', 'blue', 'orange', 'orange', 'orange', 'orange']))
          .then(_checkFontFamilies(['Roboto', 'Arial', 'serif', 'serif', 'serif', 'serif']))
          .then(_checkFontSizes([24, 18, 16, 16, 16, 16]))
          .catch(failTest)
          .then(done);
    });

    [
        {fontAttr: 'textfont'},
        {fontAttr: 'insidetextfont'}
    ].forEach(function(spec) {
        it('should fall back to layout.font scalar values for inside text (except color) if ' + spec.fontAttr + ' value ' +
          'arrays don\'t cover all slices', function(done) {
            var layout = {font: {color: 'orange', family: 'serif', size: 16}};
            var data = Lib.extendFlat({}, insideTextTestsTrace);
            data.textposition = 'inside';
            data[spec.fontAttr] = {color: ['blue', 'yellow'], family: ['Arial', 'Arial'], size: [24, 34]};

            Plotly.plot(gd, [data], layout)
              .then(_checkFontColors(['blue', 'yellow', LIGHT, LIGHT, DARK, LIGHT]))
              .then(_checkFontFamilies(['Arial', 'Arial', 'serif', 'serif', 'serif', 'serif']))
              .then(_checkFontSizes([24, 34, 16, 16, 16, 16]))
              .catch(failTest)
              .then(done);
        });
    });

    [
        {fontAttr: 'textfont'},
        {fontAttr: 'outsidetextfont'}
    ].forEach(function(spec) {
        it('should fall back to layout.font scalar values for outside text if ' + spec.fontAttr + ' value ' +
          'arrays don\'t cover all slices', function(done) {
            var layout = {font: {color: 'orange', family: 'serif', size: 16}};
            var data = Lib.extendFlat({}, insideTextTestsTrace);
            data.textposition = 'outside';
            data[spec.fontAttr] = {color: ['blue', 'yellow'], family: ['Arial', 'Arial'], size: [24, 34]};

            Plotly.plot(gd, [data], layout)
              .then(_checkFontColors(['blue', 'yellow', 'orange', 'orange', 'orange', 'orange']))
              .then(_checkFontFamilies(['Arial', 'Arial', 'serif', 'serif', 'serif', 'serif']))
              .then(_checkFontSizes([24, 34, 16, 16, 16, 16]))
              .catch(failTest)
              .then(done);
        });
    });

    function _assertTitle(msg, expText, expColor) {
        var title = d3.select('.titletext > text');
        expect(title.text()).toBe(expText, msg + ' text');
        expect(title.node().style.fill).toBe(expColor, msg + ' color');
    }

    it('show a user-defined title with a custom position and font', function(done) {
        Plotly.plot(gd, [{
            type: 'pie',
            values: [1, 2, 3],
            title: {
                text: 'yo',
                font: {color: 'blue'},
                position: 'top left'
            }
        }])
          .then(function() {
              _assertTitle('base', 'yo', 'rgb(0, 0, 255)');
              _verifyTitle(true, false, true, false, false);
          })
          .catch(failTest)
          .then(done);
    });

    it('still support the deprecated `title` structure (backwards-compatibility)', function(done) {
        Plotly.plot(gd, [{
            type: 'pie',
            values: [1, 2, 3],
            title: 'yo',
            titlefont: {color: 'blue'},
            titleposition: 'top left'
        }])
          .then(function() {
              _assertTitle('base', 'yo', 'rgb(0, 0, 255)');
              _verifyTitle(true, false, true, false, false);
          })
          .catch(failTest)
          .then(done);
    });

    it('should be able to restyle title', function(done) {
        Plotly.plot(gd, [{
            type: 'pie',
            values: [1, 2, 3],
            title: {
                text: 'yo',
                font: {color: 'blue'},
                position: 'top left'
            }
        }])
        .then(function() {
            _assertTitle('base', 'yo', 'rgb(0, 0, 255)');
            _verifyTitle(true, false, true, false, false);

            return Plotly.restyle(gd, {
                'title.text': 'oy',
                'title.font.color': 'red',
                'title.position': 'bottom right'
            });
        })
        .then(function() {
            _assertTitle('base', 'oy', 'rgb(255, 0, 0)');
            _verifyTitle(false, true, false, true, false);
        })
        .catch(failTest)
        .then(done);
    });

    it('should be able to restyle title despite using the deprecated attributes', function(done) {
        Plotly.plot(gd, [{
            type: 'pie',
            values: [1, 2, 3],
            title: 'yo',
            titlefont: {color: 'blue'},
            titleposition: 'top left'
        }])
          .then(function() {
              _assertTitle('base', 'yo', 'rgb(0, 0, 255)');
              _verifyTitle(true, false, true, false, false);

              return Plotly.restyle(gd, {
                  'title': 'oy',
                  'titlefont.color': 'red',
                  'titleposition': 'bottom right'
              });
          })
          .then(function() {
              _assertTitle('base', 'oy', 'rgb(255, 0, 0)');
              _verifyTitle(false, true, false, true, false);
          })
          .catch(failTest)
          .then(done);
    });

    it('should be able to react with new text colors', function(done) {
        Plotly.plot(gd, [{
            type: 'pie',
            values: [1, 2, 3],
            text: ['A', 'B', 'C'],
            textposition: 'inside'
        }])
        .then(_checkFontColors(['rgb(255, 255, 255)', 'rgb(68, 68, 68)', 'rgb(255, 255, 255)']))
        .then(function() {
            gd.data[0].insidetextfont = {color: 'red'};
            return Plotly.react(gd, gd.data);
        })
        .then(_checkFontColors(['rgb(255, 0, 0)', 'rgb(255, 0, 0)', 'rgb(255, 0, 0)']))
        .then(function() {
            delete gd.data[0].insidetextfont.color;
            gd.data[0].textfont = {color: 'blue'};
            return Plotly.react(gd, gd.data);
        })
        .then(_checkFontColors(['rgb(0, 0, 255)', 'rgb(0, 0, 255)', 'rgb(0, 0, 255)']))
        .then(function() {
            gd.data[0].textposition = 'outside';
            return Plotly.react(gd, gd.data);
        })
        .then(_checkFontColors(['rgb(0, 0, 255)', 'rgb(0, 0, 255)', 'rgb(0, 0, 255)']))
        .then(function() {
            gd.data[0].outsidetextfont = {color: 'red'};
            return Plotly.react(gd, gd.data);
        })
        .then(_checkFontColors(['rgb(255, 0, 0)', 'rgb(255, 0, 0)', 'rgb(255, 0, 0)']))
        .catch(failTest)
        .then(done);
    });

    it('should be able to toggle visibility', function(done) {
        var mock = Lib.extendDeep({}, require('@mocks/pie_title_multiple.json'));

        function _assert(msg, exp) {
            return function() {
                var layer = d3.select(gd).select('.pielayer');
                expect(layer.selectAll('.trace').size()).toBe(exp, msg);
            };
        }

        Plotly.plot(gd, mock)
        .then(_assert('base', 4))
        .then(function() { return Plotly.restyle(gd, 'visible', false); })
        .then(_assert('both visible:false', 0))
        .then(function() { return Plotly.restyle(gd, 'visible', true); })
        .then(_assert('back to visible:true', 4))
        .catch(failTest)
        .then(done);
    });

    checkTextTemplate([{
        type: 'pie',
        values: [1, 5, 3, 2],
        labels: ['A', 'B', 'C', 'D'],
        text: ['textA', 'textB', 'textC', 'textD'],
        textposition: 'inside',
        hovertemplate: '%{text}'
    }], 'g.slicetext', [
        ['%{label} - %{value}', ['A - 1', 'B - 5', 'C - 3', 'D - 2']],
        [['%{label} - %{value}', '%{text}', '%{value}', '%{percent}'], ['A - 1', 'textB', '3', '18.2%']],
        ['%{text}-%{color}', ['textA-#d62728', 'textB-#1f77b4', 'textC-#ff7f0e', 'textD-#2ca02c']]
    ]);
});

describe('pie hovering', function() {
    var mock = require('@mocks/pie_simple.json');

    describe('with hoverinfo set to none', function() {
        var mockCopy = Lib.extendDeep({}, mock);
        var gd;

        mockCopy.data[0].hoverinfo = 'none';

        beforeEach(function(done) {
            gd = createGraphDiv();

            Plotly.plot(gd, mockCopy.data, mockCopy.layout)
                .then(done);
        });

        afterEach(destroyGraphDiv);

        it('should fire hover event when moving from one slice to another', function(done) {
            var count = 0;
            var hoverData = [];

            gd.on('plotly_hover', function(data) {
                count++;
                hoverData.push(data);
            });

            mouseEvent('mouseover', 173, 133);
            setTimeout(function() {
                mouseEvent('mouseover', 233, 193);
                expect(count).toEqual(2);
                expect(hoverData[0]).not.toEqual(hoverData[1]);
                done();
            }, 100);
        });

        it('should fire unhover event when the mouse moves off the graph', function(done) {
            var count = 0;
            var unhoverData = [];

            gd.on('plotly_unhover', function(data) {
                count++;
                unhoverData.push(data);
            });

            mouseEvent('mouseover', 173, 133);
            mouseEvent('mouseout', 173, 133);
            setTimeout(function() {
                mouseEvent('mouseover', 233, 193);
                mouseEvent('mouseout', 233, 193);
                expect(count).toEqual(2);
                expect(unhoverData[0]).not.toEqual(unhoverData[1]);
                done();
            }, 100);
        });
    });

    describe('event data', function() {
        var mockCopy = Lib.extendDeep({}, mock);
        var width = mockCopy.layout.width;
        var height = mockCopy.layout.height;
        var gd;

        beforeEach(function(done) {
            gd = createGraphDiv();

            Plotly.plot(gd, mockCopy.data, mockCopy.layout)
                .then(done);
        });

        afterEach(destroyGraphDiv);

        it('should contain the correct fields', function() {
            var hoverData;
            var unhoverData;

            gd.on('plotly_hover', function(data) {
                hoverData = data;
            });

            gd.on('plotly_unhover', function(data) {
                unhoverData = data;
            });

            mouseEvent('mouseover', width / 2 - 7, height / 2 - 7);
            mouseEvent('mouseout', width / 2 - 7, height / 2 - 7);

            expect(hoverData.points.length).toEqual(1);
            expect(unhoverData.points.length).toEqual(1);

            var fields = [
                'curveNumber', 'pointNumber', 'pointNumbers',
                'data', 'fullData',
                'label', 'color', 'value',
                'i', 'v', 'percent', 'text'
            ];

            expect(Object.keys(hoverData.points[0]).sort()).toEqual(fields.sort());
            expect(hoverData.points[0].pointNumber).toEqual(3);

            expect(Object.keys(unhoverData.points[0]).sort()).toEqual(fields.sort());
            expect(unhoverData.points[0].pointNumber).toEqual(3);
        });

        it('should fire hover event when moving from one slice to another', function(done) {
            var count = 0;
            var hoverData = [];

            gd.on('plotly_hover', function(data) {
                count++;
                hoverData.push(data);
            });

            mouseEvent('mouseover', 173, 133);
            setTimeout(function() {
                mouseEvent('mouseover', 233, 193);
                expect(count).toEqual(2);
                expect(hoverData[0]).not.toEqual(hoverData[1]);
                done();
            }, 100);
        });

        it('should fire unhover event when the mouse moves off the graph', function(done) {
            var count = 0;
            var unhoverData = [];

            gd.on('plotly_unhover', function(data) {
                count++;
                unhoverData.push(data);
            });

            mouseEvent('mouseover', 173, 133);
            mouseEvent('mouseout', 173, 133);
            setTimeout(function() {
                mouseEvent('mouseover', 233, 193);
                mouseEvent('mouseout', 233, 193);
                expect(count).toEqual(2);
                expect(unhoverData[0]).not.toEqual(unhoverData[1]);
                done();
            }, 100);
        });
    });

    describe('labels', function() {
        var gd, mockCopy;

        beforeEach(function() {
            gd = createGraphDiv();
            mockCopy = Lib.extendDeep({}, mock);
        });

        afterEach(destroyGraphDiv);

        function _hover() {
            mouseEvent('mouseover', 223, 143);
            Lib.clearThrottle();
        }

        function _hover2() {
            mouseEvent('mouseover', 200, 250);
            Lib.clearThrottle();
        }

        function assertLabel(content, style, msg) {
            assertHoverLabelContent({nums: content}, msg);

            if(style) {
                assertHoverLabelStyle(d3.select('.hovertext'), {
                    bgcolor: style[0],
                    bordercolor: style[1],
                    fontSize: style[2],
                    fontFamily: style[3],
                    fontColor: style[4]
                }, msg);
            }
        }

        it('should show the default selected values', function(done) {
            Plotly.plot(gd, mockCopy.data, mockCopy.layout)
            .then(_hover)
            .then(function() {
                assertLabel(
                    ['4', '5', '33.3%'].join('\n'),
                    ['rgb(31, 119, 180)', 'rgb(255, 255, 255)', 13, 'Arial', 'rgb(255, 255, 255)'],
                    'initial'
                );

                return Plotly.restyle(gd, 'text', [['A', 'B', 'C', 'D', 'E']]);
            })
            .then(_hover)
            .then(function() {
                assertLabel(
                    ['4', 'E', '5', '33.3%'].join('\n'),
                    null,
                    'added text'
                );

                return Plotly.restyle(gd, 'hovertext', [[
                    'Apple', 'Banana', 'Clementine', 'Dragon Fruit', 'Eggplant'
                ]]);
            })
            .then(_hover)
            .then(function() {
                assertLabel(
                    ['4', 'Eggplant', '5', '33.3%'].join('\n'),
                    null,
                    'added hovertext'
                );

                return Plotly.restyle(gd, 'hovertext', 'SUP');
            })
            .then(_hover)
            .then(function() {
                assertLabel(
                    ['4', 'SUP', '5', '33.3%'].join('\n'),
                    null,
                    'constant hovertext'
                );

                return Plotly.restyle(gd, {
                    'hoverlabel.bgcolor': [['red', 'green', 'blue', 'yellow', 'red']],
                    'hoverlabel.bordercolor': 'yellow',
                    'hoverlabel.font.size': [[15, 20, 30, 20, 15]],
                    'hoverlabel.font.family': 'Roboto',
                    'hoverlabel.font.color': 'blue'
                });
            })
            .then(_hover)
            .then(function() {
                assertLabel(
                    ['4', 'SUP', '5', '33.3%'].join('\n'),
                    ['rgb(255, 0, 0)', 'rgb(255, 255, 0)', 15, 'Roboto', 'rgb(0, 0, 255)'],
                    'new styles'
                );

                return Plotly.restyle(gd, 'hoverinfo', [[null, null, null, null, 'label+percent']]);
            })
            .then(_hover)
            .then(function() {
                assertLabel(['4', '33.3%'].join('\n'), null, 'new hoverinfo');

                return Plotly.restyle(gd, 'hoverinfo', [[null, null, null, null, 'dont+know+what+im-doing']]);
            })
            .then(_hover)
            .then(function() {
                assertLabel(
                    ['4', 'SUP', '5', '33.3%'].join('\n'),
                    null,
                    'garbage hoverinfo'
                );
            })
            .catch(failTest)
            .then(done);
        });

        it('should show the correct separators for values', function(done) {
            mockCopy.layout.separators = '@|';
            mockCopy.data[0].values[0] = 12345678.912;
            mockCopy.data[0].values[1] = 10000;

            Plotly.plot(gd, mockCopy.data, mockCopy.layout)
            .then(_hover)
            .then(function() {
                assertLabel('0\n12|345|678@91\n99@9%');
            })
            .then(done);
        });

        it('should show falsy zero text', function(done) {
            Plotly.plot(gd, {
                data: [{
                    type: 'pie',
                    labels: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
                    values: [7, 6, 5, 4, 3, 2, 1],
                    text: [null, '', '0', 0, 1, true, false],
                    textinfo: 'label+text+value'
                }],
                layout: {
                    width: 400,
                    height: 400
                }
            })
            .then(_hover2)
            .then(function() {
                assertLabel('D\n0\n4\n14.3%');
            })
            .then(done);
        });

        it('should use hovertemplate if specified', function(done) {
            mockCopy.data[0].name = '';
            Plotly.plot(gd, mockCopy.data, mockCopy.layout)
            .then(_hover)
            .then(function() {
                assertLabel(
                    ['4', '5', '33.3%'].join('\n'),
                    ['rgb(31, 119, 180)', 'rgb(255, 255, 255)', 13, 'Arial', 'rgb(255, 255, 255)'],
                    'initial'
                );

                return Plotly.restyle(gd, 'hovertemplate', '%{value}<extra></extra>');
            })
            .then(_hover)
            .then(function() {
                assertLabel(
                    ['5'].join('\n'),
                    null,
                    'hovertemplate %{value}'
                );

                return Plotly.restyle(gd, {
                    'text': [['A', 'B', 'C', 'D', 'E']],
                    'hovertemplate': '%{text}<extra></extra>'
                });
            })
            .then(_hover)
            .then(function() {
                assertLabel(
                    ['E'].join('\n'),
                    null,
                    'hovertemplate %{text}'
                );

                return Plotly.restyle(gd, 'hovertemplate', '%{percent}<extra></extra>');
            })
            .then(_hover)
            .then(function() {
                assertLabel(
                    ['33.3%'].join('\n'),
                    null,
                    'hovertemplate %{percent}'
                );

                return Plotly.restyle(gd, 'hovertemplate', '%{label}<extra></extra>');
            })
            .then(_hover)
            .then(function() {
                assertLabel(
                    ['4'].join('\n'),
                    null,
                    'hovertemplate %{label}'
                );
            })
            .then(function() { return Plotly.restyle(gd, 'hovertemplate', [['', '', '', '', 'ht 5 %{percent:0.2%}<extra></extra>']]); })
            .then(_hover)
            .then(function() {
                assertLabel(
                    ['ht 5 33.33%'].join('\n'),
                    null,
                    'hovertemplate arrayOK'
                );
            })
            .catch(failTest)
            .then(done);
        });

        it('should honor *hoverlabel.namelength*', function(done) {
            mockCopy.data[0].name = 'loooooooooooooooooooooooong';
            mockCopy.data[0].hoverinfo = 'all';

            Plotly.plot(gd, mockCopy.data, mockCopy.layout)
            .then(_hover)
            .then(function() {
                assertHoverLabelContent({nums: '4\n5\n33.3%', name: 'looooooooooo...'}, 'base');
            })
            .then(function() { return Plotly.restyle(gd, 'hoverlabel.namelength', 2); })
            .then(_hover)
            .then(function() {
                assertHoverLabelContent({nums: '4\n5\n33.3%', name: 'lo'}, 'base');
            })
            .catch(failTest)
            .then(done);
        });

        it('should honor *hoverlabel.align*', function(done) {
            function _assert(msg, exp) {
                var tx = d3.select('g.hovertext').select('text');
                expect(tx.attr('text-anchor')).toBe(exp.textAnchor, 'text anchor|' + msg);
                expect(Number(tx.attr('x'))).toBeWithin(exp.posX, 3, 'x position|' + msg);
            }

            function _hoverLeft() {
                mouseEvent('mouseover', 100, 200);
                Lib.clearThrottle();
            }

            function _hoverRight() {
                mouseEvent('mouseover', 300, 200);
                Lib.clearThrottle();
            }

            Plotly.plot(gd, [{
                type: 'pie',
                labels: ['a', 'b']
            }], {
                showlegend: false,
                margin: {l: 0, t: 0, b: 0, r: 0},
                width: 400,
                height: 400
            })
            .then(_hoverLeft)
            .then(function() { _assert('base left sector', {textAnchor: 'start', posX: 9}); })
            .then(_hoverRight)
            .then(function() { _assert('base right sector', {textAnchor: 'end', posX: -9}); })
            .then(function() {
                return Plotly.relayout(gd, 'hoverlabel.align', 'left');
            })
            .then(_hoverLeft)
            .then(function() { _assert('align:left left sector', {textAnchor: 'start', posX: 9}); })
            .then(_hoverRight)
            .then(function() { _assert('align:left right sector', {textAnchor: 'start', posX: -37.45}); })
            .then(function() {
                return Plotly.restyle(gd, 'hoverlabel.align', 'right');
            })
            .then(_hoverLeft)
            .then(function() { _assert('align:right left sector', {textAnchor: 'end', posX: 37.45}); })
            .then(_hoverRight)
            .then(function() { _assert('align:right right sector', {textAnchor: 'end', posX: -9}); })
            .then(function() {
                return Plotly.restyle(gd, 'hoverlabel.align', [['left', 'right']]);
            })
            .then(_hoverLeft)
            .then(function() { _assert('arrayOk align:right left sector', {textAnchor: 'end', posX: 37.45}); })
            .then(_hoverRight)
            .then(function() { _assert('arrayOk align:left right sector', {textAnchor: 'start', posX: -37.45}); })
            .catch(failTest)
            .then(done);
        });
    });

    describe('should fit labels within graph div', function() {
        var gd;

        beforeEach(function() { gd = createGraphDiv(); });

        afterEach(destroyGraphDiv);

        it('- when labels overflow left and right', function(done) {
            Plotly.plot(gd, [{
                hole: 0.33,
                hoverinfo: 'label+text+percent',
                values: ['22238.58', '3145.82', '2865.21', '1664.58'],
                labels: ['label 1 - another long text label', 'label 2', 'label 3 - 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16', 'label 4'],
                hovertext: ['$22,238.58', '$3,145.82', '$2,865.21', '$1,664.58'],
                type: 'pie'
            }], {
                showlegend: false,
                width: 220,
                height: 220,
                margin: {l: 0, r: 0, t: 0, b: 0}
            })
            .then(function() { mouseEvent('mouseover', 50, 50); })
            .then(function() {
                assertHoverLabelContent({
                    nums: 'label 3 - 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16\n$2,865.21\n9.58%'
                }, 'long label to the left');

                var label = d3.select('g.hovertext');
                var bbox = label.node().getBoundingClientRect();

                expect(bbox.left).toBeWithin(1, 10, 'bbox left bound');
                expect(bbox.right).toBeWithin(275, 10, 'bbox right bound (beyond graph)');
            })
            .then(function() { mouseEvent('mouseover', 150, 150); })
            .then(function() {
                assertHoverLabelContent({
                    nums: 'label 1 - another long text label\n$22,238.58\n74.3%'
                }, 'long label to the right');

                var label = d3.select('g.hovertext');
                var bbox = label.node().getBoundingClientRect();

                expect(bbox.left).toBeWithin(30, 10, 'bbox left bound');
                expect(bbox.right).toBeWithin(220, 10, 'bbox right bound');
            })
            .catch(failTest)
            .then(done);
        });
    });
});


describe('Test event data of interactions on a pie plot:', function() {
    var mock = require('@mocks/pie_simple.json');

    var mockCopy, gd;

    var blankPos = [10, 10];
    var pointPos;

    beforeAll(function(done) {
        gd = createGraphDiv();
        mockCopy = Lib.extendDeep({}, mock);
        Plotly.plot(gd, mockCopy.data, mockCopy.layout).then(function() {
            pointPos = getClientPosition('g.slicetext');
            destroyGraphDiv();
            done();
        });
    });

    beforeEach(function() {
        gd = createGraphDiv();
        mockCopy = Lib.extendDeep({}, mock);
        Lib.extendFlat(mockCopy.data[0], {
            ids: ['marge', 'homer', 'bart', 'lisa', 'maggie'],
            customdata: [{1: 2}, {3: 4}, {5: 6}, {7: 8}, {9: 10}]
        });
    });

    afterEach(destroyGraphDiv);

    function checkEventData(data) {
        var point = data.points[0];

        expect(point.curveNumber).toBe(0);
        expect(point.pointNumber).toBe(4);
        expect(point.pointNumbers).toEqual([4]);
        expect(point.data).toBe(gd.data[0]);
        expect(point.fullData).toBe(gd._fullData[0]);
        expect(point.label).toBe('4');
        expect(point.value).toBe(5);
        expect(point.color).toBe('#1f77b4');
        expect(point.id).toEqual(['maggie']);
        expect(point.customdata).toEqual([{9: 10}]);

        // for backward compat - i/v to be removed at some point?
        expect(point.i).toBe(point.pointNumber);
        expect(point.v).toBe(point.value);

        var evt = data.event;
        expect(evt.clientX).toEqual(pointPos[0], 'event.clientX');
        expect(evt.clientY).toEqual(pointPos[1], 'event.clientY');
    }

    describe('click events', function() {
        var futureData;

        beforeEach(function(done) {
            Plotly.plot(gd, mockCopy.data, mockCopy.layout).then(done);

            gd.on('plotly_click', function(data) {
                futureData = data;
            });
        });

        it('should not be trigged when not on data points', function() {
            click(blankPos[0], blankPos[1]);
            expect(futureData).toBe(undefined);
        });

        it('should contain the correct fields', function() {
            click(pointPos[0], pointPos[1]);
            expect(futureData.points.length).toEqual(1);

            checkEventData(futureData);
        });

        it('should not contain pointNumber if aggregating', function() {
            var values = gd.data[0].values;
            var labels = [];
            for(var i = 0; i < values.length; i++) labels.push(i);
            Plotly.restyle(gd, {
                labels: [labels.concat(labels)],
                values: [values.concat(values)]
            });

            click(pointPos[0], pointPos[1]);
            expect(futureData.points.length).toEqual(1);

            expect(futureData.points[0].pointNumber).toBeUndefined();
            expect(futureData.points[0].i).toBeUndefined();
            expect(futureData.points[0].pointNumbers).toEqual([4, 9]);
        });
    });

    describe('modified click events', function() {
        var clickOpts = {
            altKey: true,
            ctrlKey: true,
            metaKey: true,
            shiftKey: true
        };
        var futureData;

        beforeEach(function(done) {
            Plotly.plot(gd, mockCopy.data, mockCopy.layout).then(done);

            gd.on('plotly_click', function(data) {
                futureData = data;
            });
        });

        it('should not be trigged when not on data points', function() {
            click(blankPos[0], blankPos[1], clickOpts);
            expect(futureData).toBe(undefined);
        });

        it('does not respond to right-click', function() {
            click(pointPos[0], pointPos[1], clickOpts);
            expect(futureData).toBe(undefined);

            // TODO: 'should contain the correct fields'
            // This test passed previously, but only because assets/click
            // incorrectly generated a click event for right click. It never
            // worked in reality.
            // expect(futureData.points.length).toEqual(1);

            // checkEventData(futureData);

            // var evt = futureData.event;
            // Object.getOwnPropertyNames(clickOpts).forEach(function(opt) {
            //     expect(evt[opt]).toEqual(clickOpts[opt], 'event.' + opt);
            // });
        });
    });

    describe('hover events', function() {
        var futureData;

        beforeEach(function(done) {
            futureData = undefined;
            Plotly.newPlot(gd, mockCopy.data, mockCopy.layout).then(done);

            gd.on('plotly_hover', function(data) {
                futureData = data;
            });
        });

        it('should contain the correct fields', function() {
            mouseEvent('mouseover', pointPos[0], pointPos[1]);

            checkEventData(futureData);
        });

        it('should not emit a hover if you\'re dragging', function() {
            gd._dragging = true;
            mouseEvent('mouseover', pointPos[0], pointPos[1]);
            expect(futureData).toBeUndefined();
        });

        it('should not emit a hover if hover is disabled', function() {
            Plotly.relayout(gd, 'hovermode', false);
            mouseEvent('mouseover', pointPos[0], pointPos[1]);
            expect(futureData).toBeUndefined();
        });
    });

    describe('unhover events', function() {
        var futureData;

        beforeEach(function(done) {
            futureData = undefined;
            Plotly.newPlot(gd, mockCopy.data, mockCopy.layout).then(done);

            gd.on('plotly_unhover', function(data) {
                futureData = data;
            });
        });

        it('should contain the correct fields', function() {
            mouseEvent('mouseover', pointPos[0], pointPos[1]);
            mouseEvent('mouseout', pointPos[0], pointPos[1]);

            checkEventData(futureData);
        });

        it('should not emit an unhover if you didn\'t first hover', function() {
            mouseEvent('mouseout', pointPos[0], pointPos[1]);
            expect(futureData).toBeUndefined();
        });
    });
});

describe('pie relayout', function() {
    var gd;

    beforeEach(function() { gd = createGraphDiv(); });

    afterEach(destroyGraphDiv);

    it('will update colors when colorway is updated', function(done) {
        var originalColors = [
            'rgb(255,0,0)',
            'rgb(0,255,0)',
            'rgb(0,0,255)',
        ];

        var relayoutColors = [
            'rgb(255,255,0)',
            'rgb(0,255,255)',
            'rgb(255,0,255)',
        ];

        function checkRelayoutColor(d, i) {
            expect(this.style.fill.replace(/\s/g, '')).toBe(relayoutColors[i]);
        }

        Plotly.newPlot(gd, [{
            labels: ['a', 'b', 'c', 'a', 'b', 'a'],
            type: 'pie'
        }], {
            colorway: originalColors
        })
        .then(function() {
            return Plotly.relayout(gd, 'colorway', relayoutColors);
        })
        .then(function() {
            var slices = d3.selectAll(SLICES_SELECTOR);
            slices.each(checkRelayoutColor);
        })
        .then(done);
    });
});

describe('Test pie interactions edge cases:', function() {
    var gd;

    beforeEach(function() { gd = createGraphDiv(); });

    afterEach(destroyGraphDiv);

    function _mouseEvent(type, v) {
        return function() {
            var el = d3.select(gd).select('.slice:nth-child(' + v + ')').node();
            mouseEvent(type, 0, 0, {element: el});
        };
    }

    function hover(v) {
        return _mouseEvent('mouseover', v);
    }

    function unhover(v) {
        return _mouseEvent('mouseout', v);
    }

    it('should keep tracking hover labels and hover events after *calc* edits', function(done) {
        var mock = Lib.extendFlat({}, require('@mocks/pie_simple.json'));
        var hoverCnt = 0;
        var unhoverCnt = 0;

        // see https://github.com/plotly/plotly.js/issues/3618

        function _assert(msg, exp) {
            expect(hoverCnt).toBe(exp.hoverCnt, msg + ' - hover cnt');
            expect(unhoverCnt).toBe(exp.unhoverCnt, msg + ' - unhover cnt');

            var label = d3.select(gd).select('g.hovertext');
            expect(label.size()).toBe(exp.hoverLabel, msg + ' - hover label cnt');

            hoverCnt = 0;
            unhoverCnt = 0;
        }

        Plotly.plot(gd, mock)
        .then(function() {
            gd.on('plotly_hover', function() {
                hoverCnt++;
                // N.B. trigger a 'calc' edit
                Plotly.restyle(gd, 'textinfo', 'percent');
            });
            gd.on('plotly_unhover', function() {
                unhoverCnt++;
                // N.B. trigger a 'calc' edit
                Plotly.restyle(gd, 'textinfo', null);
            });
        })
        .then(hover(1))
        .then(function() {
            _assert('after hovering on first sector', {
                hoverCnt: 1,
                unhoverCnt: 0,
                hoverLabel: 1
            });
        })
        .then(unhover(1))
        .then(function() {
            _assert('after un-hovering from first sector', {
                hoverCnt: 0,
                unhoverCnt: 1,
                hoverLabel: 0
            });
        })
        .then(hover(2))
        .then(function() {
            _assert('after hovering onto second sector', {
                hoverCnt: 1,
                unhoverCnt: 0,
                hoverLabel: 1
            });
        })
        .catch(failTest)
        .then(done);
    });
});
