Asynchronous interlaced update of a canvas element in javascript
================================================================

Problem description
------------------

Here is a hypothetical situation: there is a canvas element on our page,
containing pixels with coordinates from (0,0) to (`WIDTH-1`,`HEIGHT-1`). We
want to assign each pixel a color, which completely depends on pixel's
coordinates.

This is very easy to do:

```javascript
// ctx is a context object obtain from canvas'es .getContext("2d")
for( var y=0; y<HEIGHT; ++y)
for( var x=0; x<WIDTH; ++x) {
  ctx.fillStyle=pixelColor(x,y)
  ctx.fillRect(x,y,1,1)
}
```

This easy solution has a drawback. If canvas is large and/or `pixelColor`
execution takes relatively long time, complete update may take a few seconds
(or even longer). During this time user cannot see any changes in canvas
(canvas will only be updated only after the javascripts finishes and lets
browser to update on-screen elements) and user interface elements on the page
will not respond to user actions. This may make the page feel unresposive or
even be aborted by the browser for taking too long to complete.

Here is how this may be addressed.

Step 1. Chunked update
----------------------

Method of choice for dealing with a lack of responsiveness is plotting pixels in
chunks, letting the browser update the display and receive user input in
between them.

```javascript
var CHUNKSIZE=8192;
var CHUNKUPDATE=null;
function chunkedUpdate(w,h,processpixel) {
  var x=0,y=0;
  var nextchunk=function() {
    if( CHUNKUPDATE!=nextchunk ) return;
    var i=CHUNKSIZE;
    while(i--){
      processpixel(x,y); // call pixel updater
      if( ++x>=w ) {
        x=0;
        if(++y>=h) return;
      }
    }
    setTimeout(nextchunk,0);
  }
  CHUNKUPDATE=nextchunk;
  nextchunk();
}

//
// ...
// called as:
  chunkUpdate(WIDTH,HEIGHT,function(x,y){
    ctx.fillStyle=pixelColor(x,y)
    ctx.fillRect(x,y,1,1)
  })
```

In this method, the call to `chunkUpdate` intiates a drawing process where
javascript is drawing the block of 8192 pixels, then lets browser to
update the canvas and accept user input, then gets back to drawing and so until
completion.

If user changes some parameter that affects the output and intiates the drawing
while the previous drawing is still in progress, the older process will be
cancelled (this is tracked by `CHUNKUPDATE` variable) and the new one begins.
This has a benefit: if user decides, based on what he already sees, that the
parameters need to be changed, he can do that without waiting for the (now
useless) drawing to complete.

`CHUNKSIZE` needs to be selected so that it takes 100-200 ms to execute. It may
be updated dynamically within `chunkUpdate` by tracking how long it takes to
render each pixel/group of pixels. I'll leave this as an excersize to the
reader to keep the example clean and to the point.

Another thing that the production implementation may need is a callback to
execute when all pixels are processed.

Step 2. Interlaced update
-------------------------

`chunkUpdate` shows several top lines at high resolution very quickly, but what
if the interesting part of the image that affects accept/reject decision lays
furhter down? In this case user has to wait until it comes into view, which may
take more time.

We can help it by first rendering image at very low resolution, then
progressively increase resolution until every pixel is processed.
This will show the entire image right away, albeit at low resolution and the
resolution will improve as time goes. If at any point user has seen enough to
cancel the drawing and initiate a new one, he is free to do so.

Instead of drawing a single pixel on a screen we will draw
a rectangular block. Its color is the color of the pixel in the top left
corner. The size of block decreases with each pass, giving better and better
resolution image.

```javascript
var CHUNKSIZE=8192;
var CHUNKUPDATE=null;
function interlacedUpdate(w,h,processpixel,lowres)
{
  lowres=lowres||(1<<4)
  var x=0,x0=0,dx=lowres,sx=lowres;
  var y=0,y0=0,dy=lowres,sy=lowres;
  var nextchunk=function(){
    if( CHUNKUPDATE!=nextchunk ) return;
    var i=CHUNKSIZE;
    while(i--){
      processpixel(x,y,dx,dy)
      x+=sx; if(x>=w) {
        x=x0;
        y+=sy; if(y>=h) {
          if( 1>=dy )
            // Just completed smallest iteration step. Time to exit
            CHUNKUPDATE=null;
            return;
          } else if(dx==dy) {
            sx=dx;
            dx=dx/2
            x0=dx;
            sy=dy;
            y0=0;
          } else {
            sy=dy;
            dy=dy/2;
            y0=dy;
            sx=sx/2
            x0=0;
          }
          x=x0;
          y=y0;
        }
      }
    }
  }
  CHUNKUPDATE=nextchunk;
  nextchunk();
}

//
// ...
// called as:
  interlacedUpdate(WIDTH,HEIGHT,function(x,y,dx,dy){
    ctx.fillStyle=pixelColor(x,y)
    ctx.fillRect(x,y,dx,dy)
  },32)
```

Parameter `lowres` representw the size of initial low resolution block and must
be a power of 2. At each pass the resolution doubles in x-axis direction or in
y-axis direction and the process fills the pixels that should be included in
this resolution.

`processpixel` now takes 2 extra parameters, dx and sy, the size of a
current low-res pixel block. They should only affect the size of a block
displayed on a screen, not the color. The color must only depend on x and y.
The reason for this is that once pixel (x,y) is processed, the drawing will not
return to it again, so it better to have its final color. Other parts of the
block will be treated and overwritten at later steps, but the top left will
not.

The resolution in x-axis direction is doubled before the resolution
in y-axis direction.

Same interlacing method is used in "progressive" png and similar idea is used
in "progressive" .gif and .jpg.

Implementation
--------------

The function has the following signature:

```javascript
function interlace(width,height,cbpixel,cbcomplete,ib)
```

where

  `width` and `heigh` is the size of the canvas to process

  `cbpixel` is a function that generate an extended pixel. 
It takes 4 parameters: `x`,`y`, the location of a pixel, and `dx`,`dy`, the
size of the block to paint. This function will be called `width*height` times,
exactly once for each `x` from 0 to `width-1` and y from 0 to `height-1`.

  `cbcomplete` (optional) is called when all pixels had been processed. 

  `ib` (optional) is the initial size of a pixel block (default value is 16)

Example:
```javascript

<script src="interlace.min.js"></script>

...

  interlace(WIDTH,HEIGHT,function(x,y,dx,dy){
    ctx.fillStyle=pixelColor(x,y)
    ctx.fillRect(x,y,dx,dy)
  },function(){
    console.log('Complete')
  },32)
```


Conclusion
----------

I developed this function to draw fractals based on complex function iteration
(example of such fractals is Mandelbrot set).
Such fractals require a complex function be calculated multiple times for each
pixel, which takes relatively long time, and the pixels may be processed in any
order. I want to be able to change zoom and pan parameters quickly to find
interesting spots as well as be able to update handles that define fractal
appearance.

Possible improvement
--------------------

As it is implemented right now, the image is developed top to bottom, left to
right. It is also does not draw blocks of higher resolution until all blocks of
lower resolution finished.

It may be beneficial to consider different schemes. For example, we may render
the center of the screen at higher resolution first in the order of expanding
spiral and keep periphery one or two resolution steps behind until the final
passes. This will make the higher resolution of a center of the canvas visible
sooner, which is where, arguably, the most important part of the image is.

I did not implement this method, but I think it is an interesting idea.

Links
-----

Example page which uses this technique.

http://nsg.upor.net/game/pm/otf.htm


