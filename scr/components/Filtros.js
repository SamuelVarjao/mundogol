import React from 'react';

const Filtros = ({ filtros, atualizarFiltro, limparFiltros, opcoesFiltros, configFiltros }) => {
  return (
    <div className="bg-gray-800 rounded-xl p-4 mb-6 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <div className="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-medium flex items-center space-x-1">
            <span>🎯</span>
            <span>Filtros de Busca</span>
          </div>
          <button
            onClick={limparFiltros}
            className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-full text-sm font-medium transition-colors"
          >
            Limpar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        {configFiltros.map(({ key, icon, label, color }) => (
          <div key={key} className="relative">
            <select
              value={filtros[key]}
              onChange={(e) => atualizarFiltro(key, e.target.value)}
              className={`w-full bg-gradient-to-r ${color} text-white px-4 py-3 rounded-lg font-medium text-sm appearance-none cursor-pointer hover:opacity-90 transition-opacity border-none outline-none`}
            >
              <option value="" className="bg-gray-800 text-white">{label}</option>
              {opcoesFiltros[key].map(opcao => (
                <option key={opcao} value={opcao} className="bg-gray-800 text-white">
                  {opcao}
                </option>
              ))}
            </select>
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
              <span className="text-lg">{icon}</span>
            </div>
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
              <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/>
              </svg>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Filtros;
