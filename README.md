# 🚀 Redireccionamiento a nuestros otros repositorios:
- 🗄️ **Base de datos**  
  👉 [Base de datos](https://github.com/Jmurcia435/shopping-cart-bd/tree/dev)

- 💻 **Frontend (Interfaz POS)**  
  👉 [Frontend](https://github.com/Jmurcia435/shopping-cart-frontend/tree/dev)

- ⚙️ **Backend (Servicios distribuidos)**  
  👉 [Backend](https://github.com/Jmurcia435/shopping-cart-backend/tree/dev)

---

# ⚙️ Backend API

API backend desarrollada con Node.js y Express para gestionar productos, categorías y órdenes del sistema de carrito de compras, con integración a PostgreSQL.

## 📖 Descripción del Proyecto

El Backend API se encarga de la lógica de negocio y la comunicación con la base de datos.

Proporciona endpoints para:

📦 Gestión de productos
🗂️ Gestión de categorías
🧾 Procesamiento de órdenes (checkout)
🔗 Integración con el frontend mediante API REST

Está diseñado para ser escalable y fácil de configurar en entornos de desarrollo.

---

# 🗄️ Esquema de Base de Datos

El backend se conecta a las siguientes tablas:

📁 inventory.category – Categorías de productos
📦 inventory.product – Catálogo de productos
📊 inventory.inventory – Cantidades en stock
🧾 bill.bill – Órdenes generadas en checkout
📄 bill.bill_item – Detalle de productos por orden
👤 security.user – Tabla de usuarios