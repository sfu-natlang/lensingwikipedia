
function setupTSNE(container, initialQuery, globalQuery, minZoom, maxZoom) {
    var width = 1024,
    height = 768;
    // The view space for SVG; this doesn't have to correspond to screen units.
    var viewBox = { x: 0, y : 0, width: width, height: height };
    // Margins for the map.
    var margins = { left: 10, right: 10, top: 10, bottom: 10, between: 10 };

    var outerElt = $("<div class=\"tsne\"></div>").appendTo(container);
    var topBoxElt = $("<div class=\"topbox\"></div>").appendTo(outerElt);
    var svgElt = $("<svg viewBox=\"" + viewBox.x + " " + viewBox.y + " " + viewBox.width + " " + viewBox.height + "\" preserveAspectRatio=\"xMidYMid meet\"></svg>").appendTo(outerElt);

    var loadingIndicator = new LoadingIndicator(outerElt);

    fillElement(container, outerElt, 'vertical');
    setupPanelled(outerElt, topBoxElt, svgElt, 'vertical', 0, false);

    var svg = jqueryToD3(svgElt);
    var box = { x: viewBox.x + margins.left, y: viewBox.y + margins.top, width: viewBox.width - margins.left - margins.right, height: viewBox.height - margins.top - margins.bottom };

    function setLoadingIndicator(enabled) {
        svgElt.css('display', !enabled ? '' : 'none');
        loadingIndicator.enabled(enabled);
    }
    setLoadingIndicator(true);

    initialQuery.onResult({
        coordinates: { type: 'tsnecoordinates' }
    }, function (result) {
        if (result.coordinates.coordinates.length == 0) {
            loadingIndicator.error('coordinates', true);
            setLoadingIndicator(true);
        } else {
            loadingIndicator.error('coordinates', false);
            var data = getDataFromResult(result.coordinates.coordinates);
            if (renderData(data)) {
                setLoadingIndicator(false);
            } else {
                loadingIndicator.error('error rendering', true);
            }
        }
    });

    function getDataFromResult(objectArray) {
        console.log(objectArray);
        var result = [];
        $.each(objectArray, function(index, value) {
            result.push([parseFloat(value.coordinates.x, 10), parseFloat(value.coordinates.y, 10), value.id, value.sentence]);
        });
        return result;
    }

    function logResult(element, index, array) {
        console.log(element.coordinates.x)
    }

    var x;
    var y;
    var circle;

    function renderData(data) {
        x = d3.scale.linear()
        .domain([0, width])
        .range([0, width]);

        y = d3.scale.linear()
            .domain([0, height])
            .range([height, 0]);

        svg.call(d3.behavior.zoom().x(x).y(y).scaleExtent([1, 9007199254740992]).on("zoom", zoom));


        svg.append("rect")
            .attr("class", "overlay")
            .attr("width", width)
            .attr("height", height);

        circle = svg.selectAll("circle")
            .data(data)
            .enter().append("circle")
            .attr("r", 2.5)
            .attr("transform", transform)
            .on("click", renderTooltip);

        return true;
    }

    function zoom() {
      circle.attr("transform", transform);
    }

    function transform(d) {
        return "translate(" + x(d[0]) + "," + y(d[1]) + ")";
    }

    function renderTooltip(d) {
        console.log(d[2]);
    }
}