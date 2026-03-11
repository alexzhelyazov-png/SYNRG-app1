import { useState } from 'react'
import {
  Box, Typography, Paper, Button, TextField,
  Checkbox, IconButton, Chip, Collapse, Divider,
} from '@mui/material'
import AssignmentIcon        from '@mui/icons-material/Assignment'
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline'
import CloseIcon             from '@mui/icons-material/Close'
import { useApp }  from '../context/AppContext'
import { C, EASE } from '../theme'

// ─── Single task row (reused in AllClientsTasks) ─────────────────
function TaskRow({ task, onToggle, onDelete, onComment, commentText, onCommentChange, t }) {
  const [expanded, setExpanded] = useState(false)
  const done     = task.status === 'done'
  const cmtCount = (task.comments || []).length

  return (
    <Box sx={{
      mb: 1, border: `1px solid ${done ? C.border : 'var(--c-primaryA13)'}`,
      borderRadius: '12px', overflow: 'hidden',
    }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, p: '10px 14px' }}>
        <Checkbox
          checked={done}
          onChange={e => onToggle(task.id, e.target.checked)}
          size="small"
          sx={{ color: C.primary, '&.Mui-checked': { color: C.primary }, mt: '-2px', p: '3px' }}
        />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{
            fontWeight: done ? 500 : 700, fontSize: '14px',
            textDecoration: done ? 'line-through' : 'none',
            color: done ? C.muted : C.text,
          }}>
            {task.title}
          </Typography>
          {task.description && (
            <Typography sx={{ color: C.muted, fontSize: '12.5px', mt: 0.2 }}>{task.description}</Typography>
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
          <Button size="small"
            onClick={() => setExpanded(p => !p)}
            sx={{
              fontSize: '12px', color: expanded ? C.primary : C.muted, minWidth: 'auto',
              px: 0.75, py: '2px', borderRadius: '6px',
              background: expanded ? C.accentSoft : 'transparent',
              '&:hover': { background: C.accentSoft, color: C.primary },
            }}
          >
            <ChatBubbleOutlineIcon sx={{ fontSize: '13px', mr: cmtCount ? 0.4 : 0 }} />
            {cmtCount || ''}
          </Button>
          <IconButton size="small"
            onClick={() => onDelete(task.id)}
            sx={{ color: C.danger, p: '3px', '&:hover': { background: C.dangerSoft } }}
          >
            <CloseIcon sx={{ fontSize: '15px' }} />
          </IconButton>
        </Box>
      </Box>
      <Collapse in={expanded}>
        <Divider sx={{ borderColor: C.border }} />
        <Box sx={{ p: '10px 14px' }}>
          {cmtCount > 0 && (task.comments || []).map((cm, j) => (
            <Box key={cm.id || j} sx={{
              display: 'flex', gap: 1, mb: 0.75, p: '6px 10px',
              background: cm.is_coach ? C.accentSoft : 'rgba(200,197,255,0.07)',
              borderRadius: '8px',
              borderLeft: `2px solid ${cm.is_coach ? C.primary : C.purple}`,
            }}>
              <Typography sx={{ fontSize: '12px', fontWeight: 700, color: cm.is_coach ? C.primary : C.purple, minWidth: '60px', flexShrink: 0 }}>
                {cm.author}
              </Typography>
              <Typography sx={{ fontSize: '13px', color: C.text }}>{cm.text}</Typography>
            </Box>
          ))}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField size="small" fullWidth
              placeholder={t('taskCommentPlaceholder')}
              value={commentText || ''}
              onChange={e => onCommentChange(task.id, e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onComment(task.id) } }}
              inputProps={{ style: { fontSize: '13px' } }}
            />
            <Button variant="contained" size="small"
              disabled={!(commentText || '').trim()}
              onClick={() => onComment(task.id)}
              sx={{ px: 2, flexShrink: 0 }}
            >
              {t('taskCommentBtn')}
            </Button>
          </Box>
        </Box>
      </Collapse>
    </Box>
  )
}

// ─── All clients tasks view (coach only) ─────────────────────────
export function AllClientsTasks() {
  const {
    t,
    realClients,
    addTaskForClient, toggleTaskDone, deleteTask, addTaskComment,
  } = useApp()

  const [expandedClient, setExpandedClient] = useState(null)
  const [newTitles,      setNewTitles]      = useState({})
  const [commentTexts,   setCommentTexts]   = useState({})

  function handleAddTask(clientId) {
    const title = (newTitles[clientId] || '').trim()
    if (!title) return
    addTaskForClient(clientId, { title, description: '' })
    setNewTitles(p => ({ ...p, [clientId]: '' }))
  }

  function handleComment(taskId) {
    const text = (commentTexts[taskId] || '').trim()
    if (!text) return
    addTaskComment(taskId, text)
    setCommentTexts(p => ({ ...p, [taskId]: '' }))
  }

  return (
    <Box>
      <Typography variant="h2" sx={{ mb: 3, animation: `fadeInUp 0.22s ${EASE.decelerate} both` }}>
        {t('tasksCoachTitle')}
      </Typography>

      {(realClients || []).map((c, ci) => {
        const tasks   = c.tasks || []
        const pending = tasks.filter(tk => tk.status !== 'done').length
        const isOpen  = expandedClient === c.id

        return (
          <Paper key={c.id} sx={{
            mb: 1.5, overflow: 'hidden',
            animation: `fadeInUp 0.2s ${EASE.decelerate} ${ci * 0.04}s both`,
            border: isOpen ? `1px solid var(--c-primaryA13)` : undefined,
          }}>
            {/* Client header row */}
            <Box
              onClick={() => setExpandedClient(isOpen ? null : c.id)}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1.5,
                p: '14px 18px', cursor: 'pointer',
                '&:hover': { background: 'rgba(255,255,255,0.03)' },
              }}
            >
              <Box sx={{
                width: 36, height: 36, borderRadius: '50%',
                background: isOpen ? C.primaryContainer : 'rgba(255,255,255,0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '15px', fontWeight: 800,
                color: isOpen ? C.primary : C.muted, flexShrink: 0,
              }}>
                {c.name.charAt(0).toUpperCase()}
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontWeight: 700, fontSize: '15px', color: isOpen ? C.primary : C.text }}>
                  {c.name}
                </Typography>
                <Typography sx={{ fontSize: '12px', color: C.muted }}>
                  {tasks.length} задачи · {pending} предстоящи
                </Typography>
              </Box>
              {pending > 0 && (
                <Box sx={{
                  px: 1.25, py: '3px', borderRadius: '99px',
                  background: C.purpleSoft,
                  border: '1px solid rgba(200,197,255,0.2)',
                }}>
                  <Typography sx={{ fontSize: '12px', fontWeight: 700, color: C.purple }}>
                    {pending}
                  </Typography>
                </Box>
              )}
              <Typography sx={{ fontSize: '14px', color: C.muted, ml: 0.5, transition: `transform 0.2s ${EASE.standard}`, transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                ▼
              </Typography>
            </Box>

            {/* Expanded: add form + task list */}
            <Collapse in={isOpen}>
              <Divider sx={{ borderColor: C.border }} />
              <Box sx={{ p: '14px 18px' }}>
                {/* Quick add form */}
                <Box sx={{ display: 'flex', gap: 1, mb: tasks.length ? 2 : 0 }}>
                  <TextField
                    size="small" fullWidth
                    placeholder={t('addTaskPlaceholder')}
                    value={newTitles[c.id] || ''}
                    onChange={e => setNewTitles(p => ({ ...p, [c.id]: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleAddTask(c.id)}
                    inputProps={{ style: { fontSize: '14px' } }}
                  />
                  <Button
                    variant="contained" size="small"
                    disabled={!(newTitles[c.id] || '').trim()}
                    onClick={() => handleAddTask(c.id)}
                    sx={{ px: 2.5, flexShrink: 0, fontWeight: 800, fontSize: '18px' }}
                  >+</Button>
                </Box>

                {/* Task list */}
                {tasks.length === 0 ? (
                  <Typography sx={{ color: C.muted, fontSize: '13.5px', py: 1.5, textAlign: 'center' }}>
                    {t('noTasks')}
                  </Typography>
                ) : (
                  tasks.map(task => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      onToggle={toggleTaskDone}
                      onDelete={deleteTask}
                      onComment={handleComment}
                      commentText={commentTexts[task.id]}
                      onCommentChange={(id, val) => setCommentTexts(p => ({ ...p, [id]: val }))}
                      t={t}
                    />
                  ))
                )}
              </Box>
            </Collapse>
          </Paper>
        )
      })}
    </Box>
  )
}

export default function Tasks() {
  const {
    auth, client, t,
    addTask, toggleTaskDone, deleteTask, addTaskComment,
  } = useApp()

  const isCoach = auth.role === 'coach'
  const tasks   = client.tasks || []

  const [title,        setTitle]        = useState('')
  const [desc,         setDesc]         = useState('')
  const [expandedId,   setExpandedId]   = useState(null)
  const [commentTexts, setCommentTexts] = useState({})

  function handleAddTask() {
    if (!title.trim()) return
    addTask({ title: title.trim(), description: desc.trim() })
    setTitle('')
    setDesc('')
  }

  function handleComment(taskId) {
    const text = (commentTexts[taskId] || '').trim()
    if (!text) return
    addTaskComment(taskId, text)
    setCommentTexts(p => ({ ...p, [taskId]: '' }))
  }

  return (
    <Box>
      {/* ── Header ────────────────────────────────────── */}
      <Typography variant="h2" sx={{ mb: 3, animation: `fadeInUp 0.22s ${EASE.decelerate} both` }}>
        {isCoach
          ? `${t('tasksCoachTitle')} — ${client.name}`
          : t('tasksClientTitle')}
      </Typography>

      {/* ── Add task form (coach only) ───────────────── */}
      {isCoach && (
        <Paper sx={{
          p:         2.5,
          mb:        3,
          animation: `fadeInUp 0.24s ${EASE.decelerate} 0.04s both`,
        }}>
          <Typography variant="h3" sx={{ mb: 2 }}>{t('addTaskBtn')}</Typography>
          <Box sx={{ display: 'grid', gap: 1.5 }}>
            <TextField
              fullWidth
              placeholder={t('addTaskPlaceholder')}
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleAddTask()}
              inputProps={{ style: { fontSize: '15px', padding: '12px 14px' } }}
            />
            <TextField
              fullWidth
              multiline
              rows={2}
              placeholder={t('taskDescPlaceholder')}
              value={desc}
              onChange={e => setDesc(e.target.value)}
              inputProps={{ style: { fontSize: '14px', padding: '10px 14px' } }}
            />
            <Button
              variant="contained"
              disabled={!title.trim()}
              onClick={handleAddTask}
              sx={{ py: 1.5, fontWeight: 700 }}
            >
              + {t('addTaskBtn')}
            </Button>
          </Box>
        </Paper>
      )}

      {/* ── Task list ──────────────────────────────────── */}
      {tasks.length === 0 ? (
        <Box sx={{
          textAlign: 'center',
          py:        6,
          color:     C.muted,
          animation: `fadeIn 0.3s ${EASE.decelerate} both`,
        }}>
          <AssignmentIcon sx={{ fontSize: '48px', color: C.muted, mb: 1, opacity: 0.5 }} />
          <Typography>{t('noTasks')}</Typography>
        </Box>
      ) : (
        tasks.map((task, i) => {
          const done     = task.status === 'done'
          const expanded = expandedId === task.id
          const cmtCount = (task.comments || []).length

          return (
            <Paper
              key={task.id}
              sx={{
                mb:        1.5,
                overflow:  'hidden',
                animation: `fadeInUp 0.2s ${EASE.decelerate} ${i * 0.035}s both`,
                border:    done ? `1px solid ${C.border}` : `1px solid var(--c-primaryA13)`,
                transition:`border-color 0.2s ${EASE.standard}`,
              }}
            >
              {/* ── Task row ────────────────────────────── */}
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, p: '14px 16px' }}>
                <Checkbox
                  checked={done}
                  onChange={e => toggleTaskDone(task.id, e.target.checked)}
                  sx={{
                    color: C.primary,
                    '&.Mui-checked': { color: C.primary },
                    mt: '-3px',
                    p: '4px',
                  }}
                />

                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.4 }}>
                    <Typography sx={{
                      fontWeight:     done ? 500 : 700,
                      fontSize:       '15px',
                      textDecoration: done ? 'line-through' : 'none',
                      color:          done ? C.muted : C.text,
                      transition:     `all 0.2s ${EASE.standard}`,
                    }}>
                      {task.title}
                    </Typography>
                    <Chip
                      label={done ? t('taskDone') : t('taskPending')}
                      size="small"
                      sx={{
                        background: done ? C.accentSoft  : C.purpleSoft,
                        color:      done ? C.primary     : C.purple,
                        border:     `1px solid ${done ? 'var(--c-primaryA13)' : 'rgba(200,197,255,0.2)'}`,
                        fontSize:   '11px',
                        fontWeight: 700,
                        height:     '20px',
                      }}
                    />
                  </Box>

                  {task.description && (
                    <Typography sx={{ color: C.muted, fontSize: '13.5px', mb: 0.5 }}>
                      {task.description}
                    </Typography>
                  )}

                  <Typography sx={{ color: C.muted, fontSize: '12px' }}>
                    {t('assignedBy')}: <span style={{ color: C.primary, fontWeight: 600 }}>{task.assigned_by}</span>
                  </Typography>
                </Box>

                {/* Actions */}
                <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0, mt: '-2px' }}>
                  <Button
                    size="small"
                    onClick={() => setExpandedId(expanded ? null : task.id)}
                    sx={{
                      fontSize:   '12px',
                      color:      expanded ? C.primary : C.muted,
                      minWidth:   'auto',
                      px:         1,
                      py:         '3px',
                      borderRadius: '8px',
                      background: expanded ? C.accentSoft : 'transparent',
                      transition: `all 0.15s ${EASE.standard}`,
                      '&:hover':  { background: C.accentSoft, color: C.primary },
                    }}
                  >
                    <ChatBubbleOutlineIcon sx={{ fontSize: '14px', mr: cmtCount ? 0.4 : 0 }} />
                    {cmtCount || ''}
                  </Button>
                  {isCoach && (
                    <IconButton
                      size="small"
                      onClick={() => deleteTask(task.id)}
                      sx={{
                        color:    C.danger,
                        p:        '4px',
                        '&:hover': { background: C.dangerSoft },
                      }}
                    >
                      <CloseIcon sx={{ fontSize: '16px' }} />
                    </IconButton>
                  )}
                </Box>
              </Box>

              {/* ── Comments section ────────────────────── */}
              <Collapse in={expanded}>
                <Divider sx={{ borderColor: C.border }} />
                <Box sx={{ p: '12px 16px 16px' }}>

                  {/* Existing comments */}
                  {cmtCount > 0 && (
                    <Box sx={{ mb: 1.5 }}>
                      {(task.comments || []).map((cm, j) => (
                        <Box
                          key={cm.id || j}
                          sx={{
                            display:     'flex',
                            gap:         1,
                            mb:          0.75,
                            p:           '8px 12px',
                            background:  cm.is_coach ? C.accentSoft : 'rgba(200,197,255,0.07)',
                            borderRadius:'10px',
                            borderLeft:  `2px solid ${cm.is_coach ? C.primary : C.purple}`,
                          }}
                        >
                          <Typography sx={{
                            fontSize:  '12px',
                            color:     cm.is_coach ? C.primary : C.purple,
                            fontWeight:700,
                            minWidth:  '64px',
                            flexShrink:0,
                          }}>
                            {cm.author}
                          </Typography>
                          <Typography sx={{ fontSize: '13.5px', color: C.text }}>{cm.text}</Typography>
                        </Box>
                      ))}
                    </Box>
                  )}

                  {/* New comment input */}
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <TextField
                      size="small"
                      fullWidth
                      placeholder={t('taskCommentPlaceholder')}
                      value={commentTexts[task.id] || ''}
                      onChange={e => setCommentTexts(p => ({ ...p, [task.id]: e.target.value }))}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          handleComment(task.id)
                        }
                      }}
                      inputProps={{ style: { fontSize: '14px' } }}
                    />
                    <Button
                      variant="contained"
                      size="small"
                      onClick={() => handleComment(task.id)}
                      disabled={!(commentTexts[task.id] || '').trim()}
                      sx={{ px: 2, flexShrink: 0 }}
                    >
                      {t('taskCommentBtn')}
                    </Button>
                  </Box>
                </Box>
              </Collapse>
            </Paper>
          )
        })
      )}
    </Box>
  )
}
