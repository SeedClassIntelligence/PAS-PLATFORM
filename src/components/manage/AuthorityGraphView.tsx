import React, { useState } from 'react';
import { usePASStore } from '../../store/usePASStore';
import { AuthorityObject, SemanticRelationshipType } from '../../types/pas';

export function AuthorityGraphView() {
  const { authorityObjects, graphEdges, addAuthorityObject } = usePASStore();
  const [selectedObjectId, setSelectedObjectId] = useState<string>(authorityObjects[0]?.id || '');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newObjectName, setNewObjectName] = useState('');
  const [newObjectType, setNewObjectType] = useState<'ORGANIZATION' | 'PROJECT' | 'FRAMEWORK' | 'CREDENTIAL' | 'EVIDENCE'>('PROJECT');
  const [newObjectSummary, setNewObjectSummary] = useState('');

  const selectedObject = authorityObjects.find(o => o.id === selectedObjectId) || authorityObjects[0];

  const handleCreateObject = () => {
    if (!newObjectName.trim()) return;
    const newObj: AuthorityObject = {
      id: `auth-${Date.now()}`,
      name: newObjectName.trim(),
      type: newObjectType,
      summary: newObjectSummary.trim() || 'User defined authority record.',
      sources: ['Direct User Entry'],
      evidenceIds: [],
      confidenceScore: 100,
      provenance: 'USER_CONFIRMED',
      workflowState: 'PUBLISH_READY',
      visibility: 'PUBLIC',
      associatedModuleCodes: ['M03'],
      associatedDossierIds: ['d01'],
      relationships: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    addAuthorityObject(newObj);
    setSelectedObjectId(newObj.id);
    setShowAddModal(false);
    setNewObjectName('');
    setNewObjectSummary('');
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', color: '#E5E7EB' }}>
      
      {/* ── HEADER ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '30px', color: '#FFF', margin: '0 0 4px 0' }}>
            Semantic Authority Graph (Sections 13 & 14)
          </h2>
          <div style={{ fontSize: '13px', color: '#9CA3AF' }}>
            Instead of storing professional identity as flat text pages, PAS understands relationships with explicit typed semantics.
          </div>
        </div>

        <button 
          onClick={() => setShowAddModal(true)}
          style={{ background: '#D4AF37', color: '#000', border: 'none', padding: '9px 20px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>
          + Add Authority Object
        </button>
      </div>

      {/* ── GRAPH DUAL-PANE VIEW ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '20px', minHeight: '600px' }}>
        
        {/* Left: Objects List & Graph Hierarchy */}
        <div style={{ background: '#141619', border: '1px solid #26292E', borderRadius: '10px', padding: '16px', overflowY: 'auto' }}>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.12em', color: '#D4AF37', fontWeight: '700', marginBottom: '12px' }}>
            Authority Nodes ({authorityObjects.length})
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {authorityObjects.map(obj => (
              <div 
                key={obj.id} 
                onClick={() => setSelectedObjectId(obj.id)}
                style={{
                  padding: '12px 14px',
                  borderRadius: '6px',
                  background: selectedObjectId === obj.id ? '#1E2024' : 'transparent',
                  border: selectedObjectId === obj.id ? '1px solid #D4AF37' : '1px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontSize: '9px', fontWeight: '700', color: '#D4AF37' }}>{obj.type}</span>
                  <span style={{ fontSize: '9px', color: '#4A8A58' }}>✓ {obj.provenance}</span>
                </div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#FFF' }}>{obj.name}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Object Detail & Semantic Link Inspector */}
        <div style={{ background: '#141619', border: '1px solid #26292E', borderRadius: '10px', padding: '28px' }}>
          {selectedObject ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                <div>
                  <span style={{ fontSize: '10px', fontWeight: '700', padding: '3px 8px', borderRadius: '4px', background: '#1E2024', color: '#D4AF37', border: '1px solid #26292E' }}>
                    {selectedObject.type} RECORD
                  </span>
                  <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '32px', color: '#FFF', margin: '8px 0 4px 0' }}>
                    {selectedObject.name}
                  </h3>
                  <div style={{ fontSize: '12px', color: '#9CA3AF' }}>ID: {selectedObject.id} · Confidence Score: {selectedObject.confidenceScore}%</div>
                </div>

                <div style={{ display: 'flex', gap: '6px' }}>
                  <span style={{ fontSize: '10px', fontWeight: '700', padding: '4px 10px', borderRadius: '4px', background: 'rgba(74,138,88,0.15)', color: '#4A8A58', border: '1px solid rgba(74,138,88,0.3)' }}>
                    {selectedObject.provenance}
                  </span>
                  <span style={{ fontSize: '10px', fontWeight: '700', padding: '4px 10px', borderRadius: '4px', background: '#1E2024', color: '#FFF', border: '1px solid #26292E' }}>
                    {selectedObject.visibility}
                  </span>
                </div>
              </div>

              {/* Summary */}
              <div style={{ background: '#1A1C20', border: '1px solid #26292E', borderRadius: '8px', padding: '16px', marginBottom: '24px' }}>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#D4AF37', fontWeight: '700', marginBottom: '6px' }}>Canonical Summary</div>
                <div style={{ fontSize: '14px', color: '#E5E7EB', lineHeight: '1.7' }}>{selectedObject.summary}</div>
              </div>

              {/* Sources & Evidentiary Trace */}
              <div style={{ marginBottom: '24px' }}>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9CA3AF', fontWeight: '700', marginBottom: '8px' }}>Ingested Sources & Citations</div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {selectedObject.sources.map((s, i) => (
                    <span key={i} style={{ padding: '4px 12px', background: '#1E2024', border: '1px solid #26292E', borderRadius: '4px', fontSize: '12px', color: '#FFF' }}>
                      🔗 {s}
                    </span>
                  ))}
                </div>
              </div>

              {/* Semantic Relationships */}
              <div>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#D4AF37', fontWeight: '700', marginBottom: '10px' }}>
                  Semantic Graph Links (Section 14)
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {graphEdges.filter(e => e.sourceObjectId === selectedObject.id || e.targetObjectId === selectedObject.id).map(e => {
                    const isSource = e.sourceObjectId === selectedObject.id;
                    const otherNode = authorityObjects.find(o => o.id === (isSource ? e.targetObjectId : e.sourceObjectId));
                    return (
                      <div key={e.id} style={{ background: '#1E2024', border: '1px solid #26292E', borderRadius: '6px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '11px', fontWeight: '700', color: '#D4AF37', textTransform: 'uppercase', background: 'rgba(212,175,55,0.1)', padding: '2px 8px', borderRadius: '3px' }}>
                          {isSource ? e.relationship : `received_${e.relationship}`}
                        </span>
                        <span style={{ fontSize: '13px', color: '#FFF', fontWeight: '600' }}>{otherNode?.name || 'Related Node'}</span>
                        <span style={{ marginLeft: 'auto', fontSize: '10px', color: '#4A8A58' }}>✓ Confidence {e.confidenceScore}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '60px', color: '#9CA3AF' }}>Select an authority object to inspect</div>
          )}
        </div>

      </div>

      {/* Add Object Modal */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#141619', border: '2px solid #D4AF37', borderRadius: '12px', padding: '32px', width: '500px', maxWidth: '90vw' }}>
            <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '24px', color: '#D4AF37', margin: '0 0 16px 0' }}>Add Canonical Authority Object</h3>
            
            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '11px', textTransform: 'uppercase', color: '#9CA3AF', display: 'block', marginBottom: '4px' }}>Object Name</label>
              <input 
                type="text" 
                value={newObjectName} 
                onChange={e => setNewObjectName(e.target.value)} 
                placeholder="e.g. Solutionology Workforce Model" 
                style={{ width: '100%', padding: '10px', background: '#1E2024', border: '1px solid #26292E', borderRadius: '6px', color: '#FFF', fontSize: '13px' }} 
              />
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '11px', textTransform: 'uppercase', color: '#9CA3AF', display: 'block', marginBottom: '4px' }}>Object Type</label>
              <select 
                value={newObjectType} 
                onChange={e => setNewObjectType(e.target.value as any)}
                style={{ width: '100%', padding: '10px', background: '#1E2024', border: '1px solid #26292E', borderRadius: '6px', color: '#FFF', fontSize: '13px' }}>
                <option value="PROJECT">PROJECT (Engagement or Campus Build)</option>
                <option value="ORGANIZATION">ORGANIZATION (Company or Nonprofit)</option>
                <option value="FRAMEWORK">FRAMEWORK (Authored IP or System)</option>
                <option value="CREDENTIAL">CREDENTIAL (Degree or License)</option>
                <option value="EVIDENCE">EVIDENCE (Audit or Contract Proof)</option>
              </select>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '11px', textTransform: 'uppercase', color: '#9CA3AF', display: 'block', marginBottom: '4px' }}>Summary</label>
              <textarea 
                value={newObjectSummary} 
                onChange={e => setNewObjectSummary(e.target.value)} 
                placeholder="Describe this authority claim..." 
                rows={3} 
                style={{ width: '100%', padding: '10px', background: '#1E2024', border: '1px solid #26292E', borderRadius: '6px', color: '#FFF', fontSize: '13px' }} 
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowAddModal(false)} style={{ background: '#1E2024', color: '#9CA3AF', border: '1px solid #26292E', padding: '8px 16px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleCreateObject} style={{ background: '#D4AF37', color: '#000', border: 'none', padding: '8px 20px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>Save Object</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
