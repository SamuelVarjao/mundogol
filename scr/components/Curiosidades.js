import React from 'react';

const Curiosidade = ({ curiosidade }) => {
  return (
    <div className="bg-white rounded-2xl shadow-2xl p-8 border-4 border-orange-400">
      <div className="text-center mb-6">
        <div className="bg-gradient-to-r from-orange-400 to-orange-500 text-white px-6 py-2 rounded-full inline-block mb-4">
          <span className="font-bold">🃏 CARTA #{curiosidade.id}</span>
        </div>
        <div className="text-6xl mb-4">⚽</div>
      </div>
      <div className="text-center">
        <p className="text-xl text-gray-800 leading-relaxed mb-8 font-medium border-l-4 border-orange-400 pl-4 italic">
          "{curiosidade.texto}"
        </p>
        {/* Tags da curiosidade */}
        <div className="flex flex-wrap justify-center gap-3 mb-8">
          {curiosidade.pais && (
            <span className="bg-blue-100 text-blue-800 px-4 py-2 rounded-full text-sm font-medium">
              <span>🌍</span>
              <span>{curiosidade.pais}</span>
            </span>
          )}
          {/* Adicione mais tags conforme necessário */}
        </div>
      </div>
    </div>
  );
};

export default Curiosidade;
