function MetricCard({
  title,
  value,
  subtitle,
  loading = false,
  error = null,
  children,
}) {
  const formatValue = (input) => {
    if (input === null || input === undefined || input === "") {
      return "-";
    }

    if (typeof input === "boolean") {
      return input ? "Yes" : "No";
    }

    if (typeof input === "number") {
      return input.toLocaleString("en-US", {
        maximumFractionDigits: 2,
      });
    }

    return input;
  };

  return (
    <div
      style={{
        border: "1px solid #ccc",
        borderRadius: "10px",
        padding: "15px",
        minWidth: "150px",
        maxWidth: "260px",
        textAlign: "center",
        boxShadow: "0 2px 5px rgba(0,0,0,0.1)",
        margin: "6px",
        backgroundColor: "#fff",
      }}
    >
      <h3
        style={{
          margin: "0 0 10px 0",
          fontSize: "1rem",
        }}
      >
        {title}
      </h3>

      {loading && (
        <p
          style={{
            fontSize: "0.95rem",
            color: "#666",
            margin: "8px 0",
          }}
        >
          Loading...
        </p>
      )}

      {error && (
        <p
          style={{
            fontSize: "0.9rem",
            color: "red",
            fontWeight: "bold",
            margin: "8px 0",
          }}
        >
          {error}
        </p>
      )}

      {!loading && !error && (
        <p
          style={{
            fontSize: "1.25rem",
            fontWeight: "bold",
            margin: "8px 0",
            wordBreak: "break-word",
          }}
        >
          {formatValue(value)}
        </p>
      )}

      {subtitle && (
        <p
          style={{
            fontSize: "0.8rem",
            color: "#666",
            margin: "6px 0 0 0",
          }}
        >
          {subtitle}
        </p>
      )}

      {children && (
        <div
          style={{
            marginTop: "10px",
            fontSize: "0.85rem",
            textAlign: "left",
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export default MetricCard;