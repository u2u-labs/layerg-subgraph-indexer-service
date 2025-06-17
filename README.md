# Indexer Service

## Example `.graphql` Schema

```graphql
type Post {
  id: ID!
  title: String!
  content: String!
  user: User!
}

type User {
  id: ID!
  username: String!
  name: String!
}
```

## Example Query

```json
{
  "query": "query Posts($where: JSON, $limit: Int, $offset: Int, $orderBy: String, $order: String) { posts(where: $where, limit: $limit, offset: $offset, orderBy: $orderBy, order: $order) { id title content } }",
  "variables": {
    "limit": 5,
    "offset": 0,
    "orderBy": "id",
    "order": "desc",
    "where": {
      "id_in": [1],
      "id_not_in": [1000],
      "id_gt": 0,
      "id_lte": 200
    }
  }
}
```
