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
query Posts {
  posts(
    where: { id_not_in: [1000], id_gte: 0, id_lte: 200 }
    limit: 5
    offset: 5
    orderBy: "id"
    orderDirection: "asc"
  ) {
    id
    title
    content
  }
}
```
