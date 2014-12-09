
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

    var minX = 99999, minY = 9999;
    var maxX = -9999, maxY = -9999;
    
    function getDataFromResult(objectArray) {
        var result = [];
        $.each(objectArray, function(index, value) {
            var xCoordinate = parseFloat(value.coordinates.x, 10);
            var yCoordinate = parseFloat(value.coordinates.y, 10);
            if (xCoordinate < minX) {
                minX = xCoordinate;
            }
            if (yCoordinate < minY) {
                minY = yCoordinate;
            }
            if (xCoordinate > maxX) {
                maxX = xCoordinate;
            }
            if (yCoordinate > maxY) {
                maxY = yCoordinate;
            }

            result.push([xCoordinate, yCoordinate, value.id, value.text]);
        });
        return result;
    }

    var x;
    var y;
    var circle;
    var tooltip = d3.select("body").append("div")   
    .attr("class", "tooltip")               
    .style("opacity", 0);
    var tooltipRendered = false;

    function renderData(data) {
        x = d3.scale.linear()
        .domain([minX, maxX])
        .range([0, width]);

        y = d3.scale.linear()
            .domain([minY, maxY])
            .range([0, height]);

        svg.call(d3.behavior.zoom().x(x).y(y).scaleExtent([Number.MIN_VALUE, Number.MAX_VALUE]).on("zoom", zoom));


        svg.append("rect")
            .attr("class", "overlay")
            .attr("width", width)
            .attr("height", height);

        circle = svg.selectAll("circle")
            .data(data)
            .enter().append("circle")
            .attr("r", 1.5)
            .attr("transform", transform)
            .on("mouseover", renderTooltip)
            .on("mouseout", renderTooltip);

        return true;
    }

    function zoom() {
      circle.attr("transform", transform);
    }

    function transform(d) {
        return "translate(" + x(d[0]) + "," + y(d[1]) + ")";
    }

    
    function renderTooltip(d) {
        if (tooltipRendered == false) {
            tooltipRendered = true;
            tooltip.transition().duration(200).style("opacity", 1);      
            tooltip.html(d[3])
            .style("left", (d3.event.pageX) + "px")
            .style("top", (d3.event.pageY - 28) + "px");   
        } else {
            tooltipRendered = false;
            tooltip.transition().duration(500).style("opacity", 0)
        }
        
    }
}
