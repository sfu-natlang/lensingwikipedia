
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
        console.log(result.length);
        return result;
    }

    var x;
    var y;
    var circle;
    var brush;
    var quadtree;

    //Initialize Tooltip
    var tooltip = d3.select("body").append("div")   
    .attr("class", "tooltip")               
    .style("opacity", 0);
    var tooltipRendered = false;


    function renderData(data) {
        x = d3.scale.linear()
        .domain([minX, maxX])
        .range([10, width]);

        y = d3.scale.linear()
            .domain([minY, maxY])
            .range([10, height]);

        quadtree = d3.geom.quadtree()(data);

        brush = d3.svg.brush().x(x).y(y).on("brush", brushed);

        svg.call(d3.behavior.zoom().x(x).y(y).scaleExtent([Number.MIN_VALUE, Number.MAX_VALUE]).on("zoom", zoom));
        svg.on('mousedown.zoom',null);

        svg.attr("width", width)
            .attr("height", height);

        circle = svg.selectAll(".point")
            .data(data)
            .enter().append("circle")
            .attr("class", "point")
            .attr("r", 2.5)
            .attr("transform", transform)
            .on("mouseover", renderTooltip)
            .on("mouseout", renderTooltip);

        svg.append("g")
            .attr("class", "brush")
            .call(brush)
            .call(brush.event);

        return true;
    }

    function zoom() {
      circle.attr("transform", transform);
    }

    function transform(d) {
        return "translate(" + x(d[0]) + "," + y(d[1]) + ")";
    }

    function brushed() {
      var extent = brush.extent();
      circle.each(function(d) { d.selected = false; });
      search(quadtree, extent[0][0], extent[0][1], extent[1][0], extent[1][1]);
      circle.classed("selected", function(d) { return d.selected; });
    }

    function brushended() {
      if (!d3.event.sourceEvent) return; // only transition after input
      d3.select(this).transition()
          .duration(brush.empty() ? 0 : 750)
          .call(brush.event);
    }

    // Find the nodes within the specified rectangle.
    function search(quadtree, x0, y0, x3, y3) {
      quadtree.visit(function(node, x1, y1, x2, y2) {
        var p = node.point;
        if (p) p.selected = (p[0] >= x0) && (p[0] < x3) && (p[1] >= y0) && (p[1] < y3);
        return x1 >= x3 || y1 >= y3 || x2 < x0 || y2 < y0;
      });
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
