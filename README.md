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

```graphql
query {
  posts(
    where: { id_in: [1], id_not_in: [1000], id_gt: 0, id_lte: 200 }
    first: 5
    skip: 0
    orderBy: "id"
    orderDirection: "desc"
  ) {
    id
    title
    content
  }
}
```
