var states = [
    { x : 43, y : 67, label : "first" },
    { x : 340, y : 150, label : "second" },
    { x : 300, y : 350, label : "third" },
    { x : 300, y : 350, label : "fourth" },
    { x : 50, y : 270, label : "fifth" },
    { x : 90, y : 400, label : "last" }
]

window.svg = d3.select("body")
.append("svg")
.attr("width", "960px")
.attr("height", "500px");    

svg.selectAll( ".state")
.data( states)
.enter()
.append( "circle")
    .attr({
        class   : 'state',
        r       : 40,
        cx      : function( state) {
            return state.x;
        },
        cy      : function( state) {
            return state.y;
        }
    })
    .on("mouseover", function(){d3.select(this).style("fill", "aliceblue");})
    .on("mouseout", function(){d3.select(this).style("fill", "white");});
;    

svg
.on( "mousedown", function() {
    var p;
	if(event.type == "mousedown")
		p = d3.mouse( this);
	if(event.type == "touchdown")
    svg.append( "rect")
    .attr({
        rx      : 6,
        ry      : 6,
        class   : "selection",
        x       : p[0],
        y       : p[1],
        width   : 0,
        height  : 0
    })
})
.on( "mousemove", function() {
	console.log("mousemove");
    var s = svg.select( "rect.selection");

    if( !s.empty()) {
        var p = d3.mouse( this),

            d = {
                x       : parseInt( s.attr( "x"), 10),
                y       : parseInt( s.attr( "y"), 10),
                width   : parseInt( s.attr( "width"), 10),
                height  : parseInt( s.attr( "height"), 10)
            },
            move = {
                x : p[0] - d.x,
                y : p[1] - d.y
            }
        ;

        if( move.x < 1 || (move.x*2<d.width)) {
            d.x = p[0];
            d.width -= move.x;
        } else {
            d.width = move.x;       
        }

        if( move.y < 1 || (move.y*2<d.height)) {
            d.y = p[1];
            d.height -= move.y;
        } else {
            d.height = move.y;       
        }
       
        s.attr( d);
        //console.log( d);
    }
})
.on("mouseup", function() {
	console.log("mouseup");
    svg.select( ".selection").remove();
});
svg
.on( "touchstart", function() {
    var p = d3.touches( this);

    svg.append( "rect")
    .attr({
        rx      : 6,
        ry      : 6,
        class   : "selection",
        x       : p[0],
        y       : p[1],
        width   : 0,
        height  : 0
    })
})
.on( "touchmove", function() {
	console.log("touchmove");
    var s = svg.select( "rect.selection");

    if( !s.empty()) {
        var p = d3.touch( this),

            d = {
                x       : parseInt( s.attr( "x"), 10),
                y       : parseInt( s.attr( "y"), 10),
                width   : parseInt( s.attr( "width"), 10),
                height  : parseInt( s.attr( "height"), 10)
            },
            move = {
                x : p[0] - d.x,
                y : p[1] - d.y
            }
        ;

        if( move.x < 1 || (move.x*2<d.width)) {
            d.x = p[0];
            d.width -= move.x;
        } else {
            d.width = move.x;       
        }

        if( move.y < 1 || (move.y*2<d.height)) {
            d.y = p[1];
            d.height -= move.y;
        } else {
            d.height = move.y;       
        }
       
        s.attr( d);
        //console.log( d);
    }
})
.on("touchend", function() {
	console.log("touchend");
    svg.select( ".selection").remove();
});

