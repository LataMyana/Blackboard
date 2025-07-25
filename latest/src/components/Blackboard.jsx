import React, { useRef, useEffect, useState } from 'react';
import io from 'socket.io-client';
const socket = io('https://blackboard-k29q.onrender.com'); // or use your actual IP


const Blackboard = () => {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const [drawing, setDrawing] = useState(false);
  const [color, setColor] = useState('white');
  const [lineWidth, setLineWidth] = useState(2);
  const [mode, setMode] = useState('draw'); // draw, erase, select
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [theme, setTheme] = useState('dark'); // NEW
  const selectionStart = useRef(null);
  const [previewRect, setPreviewRect] = useState(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const ctx = canvas.getContext('2d');
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctxRef.current = ctx;

    // Fill background based on theme
    fillCanvasBackground(theme === 'dark' ? '#111' : '#fff');

    // Listen for other users' drawing
    socket.on('draw', ({ x1, y1, x2, y2, color, width }) => {
      drawLine(x1, y1, x2, y2, color, width, false);
    });

    socket.on('clear', () => clearCanvas(false));
    socket.on('clearArea', ({ x, y, width, height }) => {
      ctx.clearRect(x, y, width, height);
    });
   socket.on("undo", (dataUrl) => {
  const canvas = canvasRef.current;
  const ctx = ctxRef.current;
  const img = new Image();
  img.src = dataUrl;
  img.onload = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
  };
});


socket.on("redo", (imageData) => {
  const ctx = ctxRef.current;
  const canvas = canvasRef.current;
  const img = new Image();
  img.src = imageData;
  img.onload = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
  };
});


    return () => {
      socket.off('draw');
      socket.off('clear');
      socket.off('clearArea');
    };
  }, [theme]);

  const fillCanvasBackground = (bgColor) => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const getCoordinates = (e) => ({
    x: e.clientX || e.touches?.[0]?.clientX,
    y: e.clientY || e.touches?.[0]?.clientY
  });

  const drawLine = (x1, y1, x2, y2, strokeColor, strokeWidth, emit) => {
    const ctx = ctxRef.current;
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.closePath();

    if (emit) {
      socket.emit('draw', { x1, y1, x2, y2, color: strokeColor, width: strokeWidth });
    }
  };

  const startDrawing = (e) => {
    const { x, y } = getCoordinates(e);
    if (mode === 'select') {
      selectionStart.current = { x, y };
      setDrawing(true);
      setPreviewRect(null);
      return;
    }
    saveState();
    setDrawing(true);
    selectionStart.current = { x, y };
  };

  const stopDrawing = (e) => {
    if (!drawing) return;
    setDrawing(false);

    if (mode === 'select' && selectionStart.current) {
      const { x: startX, y: startY } = selectionStart.current;
      const { x: endX, y: endY } = getCoordinates(e);
      const x = Math.min(startX, endX);
      const y = Math.min(startY, endY);
      const width = Math.abs(startX - endX);
      const height = Math.abs(startY - endY);

      saveState();
      ctxRef.current.clearRect(x, y, width, height);
      socket.emit('clearArea', { x, y, width, height });
      setPreviewRect(null);
    }
  };

  const handleDraw = (e) => {
    if (!drawing) return;
    const { x, y } = getCoordinates(e);

    if (mode === 'select' && selectionStart.current) {
      const { x: startX, y: startY } = selectionStart.current;
      setPreviewRect({
        x: Math.min(startX, x),
        y: Math.min(startY, y),
        width: Math.abs(startX - x),
        height: Math.abs(startY - y)
      });
      return;
    }

    const { x: prevX, y: prevY } = selectionStart.current;
    const strokeColor = mode === 'erase' ? (theme === 'dark' ? '#111' : '#fff') : color;
    drawLine(prevX, prevY, x, y, strokeColor, lineWidth, true);
    selectionStart.current = { x, y };
  };

  const saveState = () => {
    const canvas = canvasRef.current;
    const data = canvas.toDataURL();
    setUndoStack((prev) => [...prev, data]);
    setRedoStack([]);
  };

const undo = () => {
  if (undoStack.length === 0) return;

  const canvas = canvasRef.current;
  const ctx = ctxRef.current;

  const last = undoStack[undoStack.length - 1];
  const updatedUndoStack = undoStack.slice(0, -1);

  setRedoStack((prev) => [...prev, canvas.toDataURL()]);
  setUndoStack(updatedUndoStack);

  const img = new Image();
  img.src = last;
  img.onload = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    
    // ✅ Emit the resulting canvas image to other users
    const newCanvasData = canvas.toDataURL();
    socket.emit("undo", newCanvasData);
  };
};



 const redo = () => {
  if (redoStack.length === 0) return;

  const canvas = canvasRef.current;
  const ctx = ctxRef.current;

  const last = redoStack[redoStack.length - 1];
  setUndoStack((prev) => [...prev, canvas.toDataURL()]);
  setRedoStack((prev) => prev.slice(0, -1));

  const img = new Image();
  img.src = last;
  img.onload = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);

    // ✅ Emit updated canvas image to others
    const newCanvasData = canvas.toDataURL();
    socket.emit("redo", newCanvasData);
  };
};


 const clearCanvas = (emit = true) => {
  const canvas = canvasRef.current;
  const ctx = ctxRef.current;

  saveState();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  fillCanvasBackground(theme === 'dark' ? '#111' : '#fff');

  if (emit) {
    const newCanvasData = canvas.toDataURL();
    socket.emit("clear", newCanvasData); // ✅ send new state
  }
};


  const handleSave = () => {
    const link = document.createElement('a');
    link.download = 'blackboard.png';
    link.href = canvasRef.current.toDataURL();
    link.click();
  };

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <>
      <canvas
        ref={canvasRef}
        style={{
          background: theme === 'dark' ? '#111' : '#fff',
          display: 'block',
          position: 'absolute',
          top: 0,
          left: 0,
          zIndex: 0
        }}
        onMouseDown={startDrawing}
        onMouseMove={handleDraw}
        onMouseUp={stopDrawing}
        onMouseOut={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={handleDraw}
        onTouchEnd={stopDrawing}
      />

      {/* Rectangle Preview */}
      {previewRect && (
        <div style={{
          position: 'absolute',
          left: previewRect.x,
          top: previewRect.y,
          width: previewRect.width,
          height: previewRect.height,
          border: `2px dashed ${theme === 'dark' ? '#fff' : '#000'}`,
          background: theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
          pointerEvents: 'none',
          zIndex: 1
        }} />
      )}

      {/* Toolbar */}
    <div style={{
  position: 'fixed',
  top: 10,
  left: 10,
  background: '#222',
  padding: '10px',
  borderRadius: '8px',
  zIndex: 2,
  color: 'white',
  fontSize: '12px',
  display: 'flex',
  gap: '8px',
  alignItems: 'center'
}}>
  <input
    type="color"
    title="Pick Pen Color"
    value={color}
    onChange={(e) => setColor(e.target.value)}
  />

  <input
    type="range"
    title="Adjust Pen Size"
    min="1"
    max="20"
    value={lineWidth}
    onChange={(e) => setLineWidth(Number(e.target.value))}
  />

  <button title="Draw with Pen" onClick={() => setMode('draw')}>✏️</button>
  <button title="Erase" onClick={() => setMode('erase')}>🧽</button>
  <button title="Select and Delete Area" onClick={() => setMode('select')}>🟦</button>
  <button title="Clear Entire Canvas" onClick={clearCanvas}>🧹</button>
  <button title="Save Canvas as Image" onClick={handleSave}>💾</button>
  <button title="Undo Last Action" onClick={undo}>↩️</button>
  <button title="Redo Last Undone Action" onClick={redo}>↪️</button>
   <button title="Redo Last Undone Action" onClick={toggleTheme}>{theme === 'dark' ? '🌞' : '🌙'}</button>
   
</div>

    </>
  );
};

export default Blackboard;