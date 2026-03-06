import { useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Sphere, Box, Torus } from '@react-three/drei';
import * as THREE from 'three';

function FloatingShape({ 
  position, 
  shape, 
  mousePosition 
}: { 
  position: [number, number, number]; 
  shape: 'sphere' | 'box' | 'torus';
  mousePosition: { x: number; y: number };
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (meshRef.current) {
      // Auto rotation
      meshRef.current.rotation.x += 0.001;
      meshRef.current.rotation.y += 0.002;
      
      // Parallax effect based on mouse position
      const parallaxX = mousePosition.x * 0.5;
      const parallaxY = -mousePosition.y * 0.5;
      
      meshRef.current.position.x = position[0] + parallaxX;
      meshRef.current.position.y = position[1] + parallaxY;
    }
  });

  return (
    <Float speed={2} rotationIntensity={0.5} floatIntensity={1}>
      <mesh ref={meshRef} position={position}>
        {shape === 'sphere' && <Sphere args={[0.5, 32, 32]} />}
        {shape === 'box' && <Box args={[0.8, 0.8, 0.8]} />}
        {shape === 'torus' && <Torus args={[0.5, 0.2, 16, 100]} />}
        <meshStandardMaterial
          color="#0ea5e9"
          wireframe
          transparent
          opacity={0.3}
        />
      </mesh>
    </Float>
  );
}

export function HeroBackground() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const { clientX, clientY } = event;
    const { innerWidth, innerHeight } = window;
    
    // Normalize mouse position to -1 to 1 range
    const x = (clientX / innerWidth) * 2 - 1;
    const y = (clientY / innerHeight) * 2 - 1;
    
    setMousePosition({ x, y });
  };

  return (
    <div 
      className="absolute inset-0 -z-10"
      onMouseMove={handleMouseMove}
    >
      <Canvas camera={{ position: [0, 0, 8], fov: 50 }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 5, 5]} intensity={1} />
        
        <FloatingShape position={[-4, 2, -2]} shape="sphere" mousePosition={mousePosition} />
        <FloatingShape position={[4, -2, -3]} shape="box" mousePosition={mousePosition} />
        <FloatingShape position={[-3, -3, -1]} shape="torus" mousePosition={mousePosition} />
        <FloatingShape position={[3, 3, -2]} shape="sphere" mousePosition={mousePosition} />
        <FloatingShape position={[0, -1, -4]} shape="box" mousePosition={mousePosition} />
        <FloatingShape position={[-2, 1, -3]} shape="torus" mousePosition={mousePosition} />
      </Canvas>
    </div>
  );
}
