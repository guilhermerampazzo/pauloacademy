export interface ExtraSection {
  id?: number
  title: string
  content: string
  image?: string
  order_index: number
}

export interface Course {
  id: number
  slug: string
  title: string
  subtitle: string
  description: string
  cover_image: string
  workload: number
  modality: string
  duration: string
  category: string
  price_pix: number
  price_installment: number
  installments: number
  installment_value: number
  price_original?: number
  discount_percent?: number
  active: boolean
  featured: boolean
  vacancy_count?: number
  offer_expires_at?: string
  whatsapp_message?: string
  seo_title?: string
  seo_description?: string
  professors?: Professor[]
  modules?: Module[]
  testimonials?: Testimonial[]
  extra_sections?: ExtraSection[]
  faqs?: CourseFaq[]
  related?: Course[]
  created_at: string
  updated_at: string
}

export interface CourseFaq {
  id?: number
  question: string
  answer: string
  order_index: number
}

export interface Professor {
  id: number
  name: string
  bio: string
  photo: string
  linkedin: string
  active: boolean
  role: string
  team_type: string
  specialties: string[]
}

export interface Module {
  id: number
  course_id: number
  name: string
  workload: number
  order_index: number
  disciplines: Discipline[] | string[]
}

export interface Discipline {
  id: number
  module_id: number
  name: string
  order_index: number
}

export interface Coupon {
  id: number
  course_id: number | null
  course_title?: string
  code: string
  discount_percent: number
  expires_at: string | null
  max_uses: number | null
  used_count: number
  active: boolean
  created_at: string
}

export interface OrderItem {
  course_id: number | null
  course_title: string
  unit_price: number | string
  discount: number | string
  final_price: number | string
}

export interface Order {
  id: number
  course_id: number
  course_title?: string
  coupon_id: number | null
  coupon_code?: string
  customer_name: string
  customer_email: string
  customer_phone: string
  amount: number
  payment_method: string
  payment_id: string
  payment_url: string
  status: 'pending' | 'paid' | 'failed' | 'refunded'
  created_at: string
  items?: OrderItem[]
  customer_cpf?: string
  payment_error?: string | null
  payment_status_detail?: string | null
  paid_at?: string | null
  tmb_order_id?: number | null
  tmb_status?: string | null
  tmb_phase?: string | null
}

export interface ContentSection {
  id: number
  key: string
  title: string
  data: Record<string, unknown>
  updated_at: string
}

export interface Testimonial {
  id: number
  name: string
  role: string
  content: string
  photo?: string
  course_id?: number
  active: boolean
  order_index: number
}

export interface DashboardStats {
  courses: number
  professors: number
  orders: { total: number; paid: number; pending: number }
  revenue: number
  recent_orders: Order[]
}
