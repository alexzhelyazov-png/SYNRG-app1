import { useState } from 'react'
import { Box, Typography, Paper, TextField, Button, IconButton } from '@mui/material'
import SendIcon from '@mui/icons-material/Send'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import { useApp } from '../context/AppContext'
import { C, EASE } from '../theme'

const EMOJIS = ['👍', '❤️', '🔥', '💪']

export default function CommunityFeed() {
  const {
    auth, lang, t,
    feedPosts, addFeedPost, deleteFeedPost,
    postReactions, postComments, togglePostReaction, addPostComment, deletePostComment,
  } = useApp()

  const [postText, setPostText] = useState('')
  const [expandedComments, setExpandedComments] = useState({}) // postId -> bool
  const [commentTexts, setCommentTexts] = useState({})         // postId -> string

  function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1)    return lang === 'bg' ? 'сега' : 'now'
    if (mins < 60)   return `${mins} ${lang === 'bg' ? 'мин.' : 'min'}`
    if (mins < 1440) return `${Math.floor(mins / 60)} ${lang === 'bg' ? 'ч.' : 'h'}`
    return `${Math.floor(mins / 1440)} ${lang === 'bg' ? 'д.' : 'd'}`
  }

  function handleSubmitPost() {
    if (!postText.trim()) return
    addFeedPost(postText.trim())
    setPostText('')
  }

  function handleSubmitComment(postId) {
    const text = (commentTexts[postId] || '').trim()
    if (!text) return
    addPostComment(postId, text)
    setCommentTexts(prev => ({ ...prev, [postId]: '' }))
  }

  const isCoach = auth.role === 'coach' || auth.role === 'admin'
  const posts = feedPosts.filter(Boolean)

  return (
    <Paper sx={{ p: 2.5 }}>
      {/* Header */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="h3">{t('feedTitle')}</Typography>
        <Typography sx={{ fontSize: '13px', color: C.muted, mt: 0.5 }}>
          {lang === 'bg' ? 'Сподели прогрес, мотивирай другите' : 'Share progress, motivate others'}
        </Typography>
      </Box>

      {/* Post input */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2.5 }}>
        <TextField
          fullWidth size="small"
          placeholder={t('feedPlaceholder')}
          value={postText}
          onChange={e => setPostText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmitPost() } }}
          multiline maxRows={3}
          sx={{
            '& .MuiInputBase-input': { color: C.text, fontSize: '14px' },
            '& .MuiOutlinedInput-notchedOutline': { borderColor: C.border },
            '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': { borderColor: C.primary },
          }}
        />
        <Button variant="contained" size="small" disabled={!postText.trim()}
          onClick={handleSubmitPost}
          sx={{ background: C.primary, color: C.primaryOn, fontWeight: 700, minWidth: 0, px: 2, alignSelf: 'flex-end' }}>
          <SendIcon sx={{ fontSize: 18 }} />
        </Button>
      </Box>

      {/* Posts */}
      {posts.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 3 }}>
          <Typography sx={{ color: C.muted, fontSize: '14px', mb: 0.5 }}>
            {lang === 'bg' ? 'Бъди първият, който пише!' : 'Be the first to post!'}
          </Typography>
          <Typography sx={{ color: C.muted, fontSize: '12px', opacity: 0.6 }}>
            {lang === 'bg' ? 'Сподели тренировка, успех или мотивация' : 'Share a workout, win or motivation'}
          </Typography>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
          {posts.slice(0, 50).map((post, i, arr) => {
            const isOwn  = post.client_id === auth.id || post.author_name === auth.name
            const isTmp  = String(post.id).startsWith('tmp_')
            const myReactions = new Set(
              postReactions.filter(r => r.post_id === post.id && r.author_name === auth.name).map(r => r.emoji)
            )
            const reactionCounts = {}
            postReactions.filter(r => r.post_id === post.id).forEach(r => {
              reactionCounts[r.emoji] = (reactionCounts[r.emoji] || 0) + 1
            })
            const comments = postComments.filter(c => c.post_id === post.id)
              .sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''))
            const commentsOpen = !!expandedComments[post.id]
            const commentText  = commentTexts[post.id] || ''

            return (
              <Box key={post.id} sx={{
                py: 1.5,
                borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : 'none',
                opacity: isTmp ? 0.6 : 1,
                animation: `fadeIn 0.2s ${EASE.standard} both`,
                animationDelay: `${i * 0.03}s`,
              }}>
                {/* Post header + content */}
                <Box sx={{ display: 'flex', gap: 1.5 }}>
                  <Box sx={{
                    width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                    background: isOwn ? C.primaryContainer : 'rgba(255,255,255,0.08)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '13px', fontWeight: 800, color: isOwn ? C.purple : C.muted,
                  }}>
                    {(post.author_name || '?').charAt(0).toUpperCase()}
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25 }}>
                      <Typography sx={{ fontSize: '13px', fontWeight: 700, color: isOwn ? C.purple : C.text }}>
                        {post.author_name}
                      </Typography>
                      <Typography sx={{ fontSize: '11px', color: C.muted }}>{timeAgo(post.created_at)}</Typography>
                    </Box>
                    <Typography sx={{ fontSize: '14px', color: C.text, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {post.content}
                    </Typography>
                  </Box>
                  {(isOwn || isCoach) && !isTmp && (
                    <IconButton size="small" onClick={() => deleteFeedPost(post.id)}
                      sx={{ color: C.muted, opacity: 0.4, alignSelf: 'flex-start', p: 0.5,
                        '&:hover': { opacity: 1, color: '#F87171' } }}>
                      <DeleteOutlineIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  )}
                </Box>

                {/* Reaction bar + comment toggle */}
                {!isTmp && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1, ml: 5.5, flexWrap: 'wrap' }}>
                    {EMOJIS.map(emoji => {
                      const count = reactionCounts[emoji] || 0
                      const active = myReactions.has(emoji)
                      return (
                        <Box key={emoji} onClick={() => togglePostReaction(post.id, emoji)}
                          sx={{
                            display: 'flex', alignItems: 'center', gap: 0.4,
                            px: 1, py: 0.3, borderRadius: '100px', cursor: 'pointer',
                            fontSize: '14px',
                            background: active ? 'rgba(196,233,191,0.18)' : 'rgba(255,255,255,0.04)',
                            border: `1px solid ${active ? C.primary : C.border}`,
                            transition: 'all 0.15s',
                            '&:hover': { background: 'rgba(196,233,191,0.12)', borderColor: C.primary },
                          }}>
                          <span>{emoji}</span>
                          <Typography sx={{ fontSize: '11px', fontWeight: 700, color: active ? C.primary : C.muted, lineHeight: 1 }}>
                            {count}
                          </Typography>
                        </Box>
                      )
                    })}

                    {/* Comment toggle */}
                    <Box onClick={() => setExpandedComments(prev => ({ ...prev, [post.id]: !commentsOpen }))}
                      sx={{
                        ml: 0.5, px: 1, py: 0.3, borderRadius: '100px', cursor: 'pointer',
                        fontSize: '12px', color: commentsOpen ? C.primary : C.muted,
                        border: `1px solid ${commentsOpen ? C.primary : C.border}`,
                        background: commentsOpen ? 'rgba(196,233,191,0.1)' : 'transparent',
                        transition: 'all 0.15s',
                        '&:hover': { borderColor: C.primary, color: C.primary },
                      }}>
                      {lang === 'bg'
                        ? `Коментари (${comments.length})`
                        : `Comments (${comments.length})`}
                    </Box>
                  </Box>
                )}

                {/* Comments section */}
                {commentsOpen && (
                  <Box sx={{ ml: 5.5, mt: 1.5 }}>
                    {/* Existing comments */}
                    {comments.map(c => {
                      const cIsOwn = c.author_name === auth.name
                      const cIsTmp = String(c.id).startsWith('tmp_c_')
                      return (
                        <Box key={c.id} sx={{
                          display: 'flex', gap: 1, mb: 1, opacity: cIsTmp ? 0.5 : 1,
                        }}>
                          <Box sx={{
                            width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                            background: cIsOwn ? C.primaryContainer : 'rgba(255,255,255,0.08)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '10px', fontWeight: 800, color: cIsOwn ? C.purple : C.muted,
                          }}>
                            {(c.author_name || '?').charAt(0).toUpperCase()}
                          </Box>
                          <Box sx={{
                            flex: 1, background: 'rgba(255,255,255,0.04)', borderRadius: '10px',
                            px: 1.5, py: 0.75,
                          }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography sx={{ fontSize: '12px', fontWeight: 700, color: cIsOwn ? C.purple : C.text }}>
                                {c.author_name}
                              </Typography>
                              <Typography sx={{ fontSize: '10px', color: C.muted }}>{timeAgo(c.created_at)}</Typography>
                              {(cIsOwn || isCoach) && !cIsTmp && (
                                <IconButton size="small" onClick={() => deletePostComment(c.id)}
                                  sx={{ ml: 'auto', p: 0.25, color: C.muted, opacity: 0.4,
                                    '&:hover': { opacity: 1, color: '#F87171' } }}>
                                  <DeleteOutlineIcon sx={{ fontSize: 12 }} />
                                </IconButton>
                              )}
                            </Box>
                            <Typography sx={{ fontSize: '13px', color: C.text, lineHeight: 1.4, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                              {c.content}
                            </Typography>
                          </Box>
                        </Box>
                      )
                    })}

                    {/* Comment input */}
                    <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                      <TextField
                        fullWidth size="small"
                        placeholder={lang === 'bg' ? 'Напиши коментар...' : 'Write a comment...'}
                        value={commentText}
                        onChange={e => setCommentTexts(prev => ({ ...prev, [post.id]: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmitComment(post.id) } }}
                        sx={{
                          '& .MuiInputBase-input': { color: C.text, fontSize: '13px', py: 0.75 },
                          '& .MuiOutlinedInput-notchedOutline': { borderColor: C.border },
                        }}
                      />
                      <IconButton size="small" disabled={!commentText.trim()}
                        onClick={() => handleSubmitComment(post.id)}
                        sx={{ background: commentText.trim() ? C.primary : 'transparent', color: commentText.trim() ? C.primaryOn : C.muted,
                          borderRadius: '8px', px: 1.5, transition: 'all 0.15s' }}>
                        <SendIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Box>
                  </Box>
                )}
              </Box>
            )
          })}
        </Box>
      )}
    </Paper>
  )
}
