import { Link, useParams } from 'react-router-dom'
import { getCategoryById } from '../data/nav'

export function CategoryPage() {
  const params = useParams()
  const categoryId = params.categoryId || ''

  const category = getCategoryById(categoryId)
  const posts = category
    ? category.sections.flatMap((section) =>
        section.items
          .filter((item) => item.type === 'md')
          .map((item) => ({ section: section.title, item })),
      )
    : []

  if (!category) {
    return (
      <div className="page">
        <h1>未找到栏目</h1>
        <Link to="/" className="pill">
          返回首页
        </Link>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="pageHeader">
        <h1>{category.title}</h1>
        <div className="muted">{category.description}</div>
      </div>

      <div className="sections">
        <div className="section">
          <h2>内容列表</h2>
          <div className="items">
            {posts.length > 0 ? (
              posts.map(({ section, item }) => (
                <Link key={item.id} className="item" to={`/p/${item.path}`}>
                  {item.title}
                  <span className="itemMeta">{section}</span>
                </Link>
              ))
            ) : (
              <div className="muted">这个栏目下还没有内容。</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
