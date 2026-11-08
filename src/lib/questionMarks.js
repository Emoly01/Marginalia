// What I've decided about a question: answered (with the answer, if I
// wrote one) or set aside (not really a question). One doc per question in
// campaigns/{cid}/questions, keyed by questionId() — a question with no
// doc is open. The question itself is never stored here: it lives where I
// wrote it, and this only remembers the verdict.
import { collection, doc, setDoc, deleteDoc, onSnapshot, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'

const marksRef = (userId, campaignId) => collection(db, 'users', userId, 'campaigns', campaignId, 'questions')

/** onSnapshot on the campaign's verdicts → { [questionId]: { status, answer, … } }. */
export function subscribeQuestionMarks(userId, campaignId, cb, onError) {
  return onSnapshot(
    marksRef(userId, campaignId),
    (snap) => cb(Object.fromEntries(snap.docs.map((d) => [d.id, d.data()]))),
    onError
  )
}

/** Mark a question answered or set aside. Queued offline; not awaited by callers at the table. */
export function markQuestion(userId, campaignId, question, { status, answer = '' }) {
  return setDoc(doc(marksRef(userId, campaignId), question.id), {
    status,
    answer: String(answer ?? '').trim(),
    key: question.key,
    text: question.text,
    markedAt: serverTimestamp(),
  })
}

/** Back to open. */
export function reopenQuestion(userId, campaignId, questionId) {
  return deleteDoc(doc(marksRef(userId, campaignId), questionId))
}
