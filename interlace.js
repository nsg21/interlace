// (C) nsg, 2015
// MIT License

// example cbpixel
// scr is global Screen5 object
// function plot_pixel_as_block(x,y,dx,dy)
// {
//         scr.setColor(pixelColor.call(scr,x,y))
//         scr.ctx.fillRect(x,y,dx,dy);
// }

// Traverse pixels for x:0..width-1 and y:0..height-1 in interlaced order
// Initial interlace block is ib × ib (ib better be power of 2)
// Call cbpixel(x,y,dx,dy) on each pixel
// Call cbcomplete() on completion
//
// Rendering is performed in batches. After each batch rendering stops and
// remainder is pushed onto event loop. (batch size is a floating value and is
// adjusted so that render time of a batch is 100-200 ms)
//
// Assumption:
// only one thing is rendered at a time. If new interlaced render command is
// issued while previous is still in progress, the older is aborted as soon as
// it gets control
// 
function interlace(width,height,cbpixel,cbcomplete,ib) {
    ib=ib||(1<<4)
    var x=0,x0=0,dx=ib,sx=ib; // dx is output block size, sx is step size
    var y=0,y0=0,dy=ib,sy=ib;
    interlace.BATCH=interlace.BATCH||(1<<10); // number of pixels in a batch that does not produce UI freezes; need to be adjusted for computer speed and mapping complexity
    var ontimer=function(){
      if( interlace.RENDER!==ontimer ) return;
      var t0=new Date(); // measure batch duration
      var i=interlace.BATCH+1
      batch:while(--i) {
        cbpixel(x,y,dx,dy);
        x+=sx
        if( x>=width ) {
          x=x0;
          y+=sy
          if( y>=height ) {
            if( 1>=dy ) {
              // just completed smallest iteration step
              // time to exit
              interlace.RENDER=null;
              if( 'function'==typeof(cbcomplete) ) cbcomplete();
              return;
            } else if(dx==dy) {
              // completed dx sized intermediate 
              // keep y step as it was, change x step
              sx=dx;
              dx=dx/2
              x0=dx;
              sy=dy;
              y0=0;
            } else {
              // completed half of the intermediate 
              // change x and y steps
              sy=dy;
              dy=dy/2;
              y0=dy;
              sx=sx/2
              x0=0;
            }
            x=x0;
            y=y0;
            // break batch; //  to display completed intermediate res frame
          }
        }
      }
      t0=new Date()-t0;
      console.log( interlace.BATCH,' in ',t0,' ms')
      i=interlace.BATCH;
      if( t0>200 && i>1<<6) i>>=1;
      if( t0<100 && i<1<<20 ) i*=2;
      interlace.BATCH=i
      setTimeout(ontimer,0);
    }
    interlace.RENDER=ontimer;
    ontimer();
}
