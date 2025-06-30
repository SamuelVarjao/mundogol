import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';  // Adicionando a importação de ReactDOM
import './styles.css';  // Importando o arquivo de estilo

import Filtros from './components/Filtros';
import Curiosidade from './components/Curiosidades';
import Estatisticas from './components/Estatisticas';
import curiosidadesDB from './data/curiosidades.json'; // Importando o arquivo JSON

const MundoGol = () => {
  const [curiosidadeAtual, setCuriosidadeAtual] = useState(null);
  const [curiosidadesExibidas, setCuriosidadesExibidas] = useState([]);
  const [filtros, setFiltros] = useState({
    pais: '',
    time: '',
    campeonato: '',
    jogador: '',
    decada: ''
  });
  const [embaralhando, setEmbaralhando] = useState(false);

  // Função para filtrar curiosidades com base nos filtros
  const obterCuriosidadesFiltradas = () => {
    return curiosidadesDB.filter(curiosidade => {
      return Object.keys(filtros).every(filtro => {
        if (!filtros[filtro]) return true;
        return curiosidade[filtro].toLowerCase().includes(filtros[filtro].toLowerCase());
      });
    });
  };

  // Função para sortear curiosidade
  const sortearCuriosidade = () => {
    if (embaralhando) return; // Previne múltiplos cliques enquanto embaralha
    setEmbaralhando(true);

    setTimeout(() => {
      const curiosidadesFiltradas = obterCuriosidadesFiltradas();
      const indiceAleatorio = Math.floor(Math.random() * curiosidadesFiltradas.length);
      const novaCuriosidade = curiosidadesFiltradas[indiceAleatorio];

      setCuriosidadeAtual(novaCuriosidade);
      setCuriosidadesExibidas(prev => [...prev, novaCuriosidade.id]);

      setEmbaralhando(false);
    }, 2000); // Embaralhamento simulado por 2 segundos
  };

  // Atualizando filtros
  const atualizarFiltro = (key, value) => {
    setFiltros(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="App">
      <Filtros filtros={filtros} atualizarFiltro={atualizarFiltro} />
      {curiosidadeAtual && <Curiosidade curiosidade={curiosidadeAtual} />}
      <Estatisticas curiosidadesExibidas={curiosidadesExibidas} />
      <button onClick={sortearCuriosidade} disabled={embaralhando}>
        {embaralhando ? 'Embaralhando...' : 'Sortear Curiosidade'}
      </button>
    </div>
  );
};

// O ponto de entrada do React
const rootElement = document.getElementById('root');
ReactDOM.render(<MundoGol />, rootElement);

export default MundoGol;
