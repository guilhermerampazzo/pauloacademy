import { redirect } from 'next/navigation'
import { getCourse } from '@/lib/data'

// v2: o checkout agora é único (/checkout). Links antigos /checkout/<slug>
// continuam funcionando: redirecionam para /checkout?curso=<id>.
export default async function LegacyCheckout({ params }: { params: { slug: string } }) {
  const course = await getCourse(params.slug)
  if (!course) redirect('/cursos')
  redirect(`/checkout?curso=${course.id}`)
}
