// MockProvider: Fallback-Daten für Offline-Modus

export function getMockData(entityType) {
  console.log(`🔍 Lade Mock-Daten für ${entityType}`);
  switch (entityType) {
    case 'unternehmen':
      return [
        {
          id: '1',
          firmenname: 'Beispiel GmbH',
          branche: 'Tech',
          webseite: 'https://beispiel.de',
          created_at: new Date().toISOString()
        },
        {
          id: '2',
          firmenname: 'Test AG',
          branche: 'Business',
          webseite: 'https://test.de',
          created_at: new Date().toISOString()
        }
      ];
    case 'marke':
      return [
        {
          id: '1',
          markenname: 'Beispiel Marke',
          unternehmen_id: '1',
          branche: 'Tech',
          webseite: 'https://marke.de',
          created_at: new Date().toISOString(),
          unternehmen: {
            id: '1',
            firmenname: 'Beispiel GmbH'
          }
        }
      ];
    default:
      return [];
  }
}

export function getMockFilterData(entityType) {
  const filterData = {
    creator: {
      sprachen: ['Deutsch', 'Englisch', 'Französisch', 'Spanisch'],
      branche: ['Mode', 'Beauty', 'Fitness', 'Food', 'Tech', 'Lifestyle'],
      creator_type: ['Influencer', 'Content Creator', 'Künstler', 'Experte'],
      instagram_follower_min: 1000,
      instagram_follower_max: 1000000
    },
    unternehmen: {
      branche: ['Mode', 'Beauty', 'Fitness', 'Food', 'Tech', 'Lifestyle']
    },
    marke: {
      branche: [
        { value: 'Beauty & Fashion', label: 'Beauty & Fashion' },
        { value: 'Fitness & Gesundheit', label: 'Fitness & Gesundheit' },
        { value: 'Food & Lifestyle', label: 'Food & Lifestyle' },
        { value: 'Gaming', label: 'Gaming' },
        { value: 'Tech', label: 'Tech' },
        { value: 'Travel', label: 'Travel' },
        { value: 'Business', label: 'Business' },
        { value: 'Education', label: 'Education' }
      ],
      unternehmen_id: [
        { value: '1', label: 'Beispiel GmbH' },
        { value: '2', label: 'Test AG' }
      ]
    },
    kampagne: {
      status: ['Aktiv', 'In Planung', 'Abgeschlossen', 'Pausiert'],
      budget_min: 1000,
      budget_max: 50000
    },
    kooperation: {
      status: ['Angefragt', 'Bestätigt', 'In Bearbeitung', 'Abgeschlossen', 'Abgelehnt'],
      budget_min: 500,
      budget_max: 10000
    }
  };

  return filterData[entityType] || {};
}
